import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  CommentRecord,
  FavoriteRecord,
  ReadingListRecord,
  ReadingListType,
  ReviewRecord,
} from "../../../../contracts/domain";
import type {
  CommunityListRequest,
  CommunityListResult,
} from "../lib/communityGuardrails";
import { paginateCommunityItems } from "../lib/communityGuardrails";
import { getDynamoDocumentClient } from "../../../shared/dynamo";
import { getRequiredEnv } from "../../../shared/env";

interface FavoriteItem {
  pk: string;
  sk: string;
  entityType: "favorite";
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
}

interface ReadingListItem {
  pk: string;
  sk: string;
  entityType: "readingList";
  id: string;
  userId: string;
  bookId: string;
  listType: ReadingListType;
  addedAt: string;
  finishedAt?: string;
  progress?: number;
}

interface CommentItem {
  pk: string;
  sk: string;
  entityType: "comment";
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

interface RatingItem {
  pk: string;
  sk: string;
  entityType: "rating";
  id: string;
  bookId: string;
  userId: string;
  rating: number;
  createdAt: string;
}

interface ReviewItem {
  pk: string;
  sk: string;
  entityType: "review";
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  rating: number;
  review: string;
  createdAt: string;
  helpful: number;
}

function getUserPartitionKey(userId: string): string {
  return `USER#${userId}`;
}

function getBookPartitionKey(bookId: string): string {
  return `BOOK#${bookId}`;
}

function getFavoriteSortKey(bookId: string): string {
  return `FAVORITE#${bookId}`;
}

function getReadingListSortKey(bookId: string): string {
  return `READING_LIST#${bookId}`;
}

function getCommentSortKey(commentId: string): string {
  return `COMMENT#${commentId}`;
}

function getRatingSortKey(userId: string): string {
  return `RATING#USER#${userId}`;
}

function getReviewSortKey(reviewId: string): string {
  return `REVIEW#${reviewId}`;
}

function toFavoriteRecord(item: FavoriteItem): FavoriteRecord {
  return {
    id: item.id,
    userId: item.userId,
    bookId: item.bookId,
    createdAt: item.createdAt,
  };
}

function toReadingListRecord(item: ReadingListItem): ReadingListRecord {
  return {
    id: item.id,
    userId: item.userId,
    bookId: item.bookId,
    listType: item.listType,
    addedAt: item.addedAt,
    ...(item.finishedAt ? { finishedAt: item.finishedAt } : {}),
    ...(typeof item.progress === "number" ? { progress: item.progress } : {}),
  };
}

function toCommentRecord(item: CommentItem): CommentRecord {
  return {
    id: item.id,
    bookId: item.bookId,
    userId: item.userId,
    userName: item.userName,
    text: item.text,
    createdAt: item.createdAt,
  };
}

function toReviewRecord(item: ReviewItem): ReviewRecord {
  return {
    id: item.id,
    userId: item.userId,
    userName: item.userName,
    bookId: item.bookId,
    rating: item.rating,
    review: item.review,
    createdAt: item.createdAt,
    helpful: item.helpful,
  };
}

export class UserStateRepository {
  private readonly client = getDynamoDocumentClient();
  private readonly tableName = getRequiredEnv("USER_STATE_TABLE_NAME");

  async listFavorites(userId: string): Promise<FavoriteRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": getUserPartitionKey(userId),
          ":skPrefix": "FAVORITE#",
        },
      }),
    );

    const items = (response.Items ?? []) as FavoriteItem[];

    return items
      .map((item: FavoriteItem) => toFavoriteRecord(item))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async addFavorite(userId: string, bookId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: getUserPartitionKey(userId),
          sk: getFavoriteSortKey(bookId),
        },
        UpdateExpression: [
          "SET entityType = :entityType",
          "id = if_not_exists(id, :id)",
          "userId = :userId",
          "bookId = :bookId",
          "createdAt = if_not_exists(createdAt, :createdAt)",
        ].join(", "),
        ExpressionAttributeValues: {
          ":entityType": "favorite",
          ":id": `favorite:${userId}:${bookId}`,
          ":userId": userId,
          ":bookId": bookId,
          ":createdAt": now,
        },
      }),
    );
  }

  async removeFavorite(userId: string, bookId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: getUserPartitionKey(userId),
          sk: getFavoriteSortKey(bookId),
        },
      }),
    );
  }

  async listReadingLists(userId: string): Promise<ReadingListRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": getUserPartitionKey(userId),
          ":skPrefix": "READING_LIST#",
        },
      }),
    );

    const items = (response.Items ?? []) as ReadingListItem[];

    return items
      .map((item: ReadingListItem) => toReadingListRecord(item))
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
  }

  async upsertReadingList(
    userId: string,
    input: {
      bookId: string;
      listType: ReadingListType;
      progress?: number;
      finishedAt?: string | null;
    },
  ): Promise<void> {
    const addedAt = new Date().toISOString();
    const setExpressions = [
      "entityType = :entityType",
      "id = if_not_exists(id, :id)",
      "userId = :userId",
      "bookId = :bookId",
      "listType = :listType",
      "addedAt = if_not_exists(addedAt, :addedAt)",
    ];
    const removeExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {
      ":entityType": "readingList",
      ":id": `reading-list:${userId}:${input.bookId}`,
      ":userId": userId,
      ":bookId": input.bookId,
      ":listType": input.listType,
      ":addedAt": addedAt,
    };

    if (typeof input.progress === "number") {
      setExpressions.push("progress = :progress");
      expressionAttributeValues[":progress"] = input.progress;
    } else {
      removeExpressions.push("progress");
    }

    if (input.finishedAt) {
      setExpressions.push("finishedAt = :finishedAt");
      expressionAttributeValues[":finishedAt"] = input.finishedAt;
    } else {
      removeExpressions.push("finishedAt");
    }

    const updateExpressionParts = [`SET ${setExpressions.join(", ")}`];

    if (removeExpressions.length > 0) {
      updateExpressionParts.push(`REMOVE ${removeExpressions.join(", ")}`);
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: getUserPartitionKey(userId),
          sk: getReadingListSortKey(input.bookId),
        },
        UpdateExpression: updateExpressionParts.join(" "),
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
  }

  async removeReadingList(userId: string, bookId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: getUserPartitionKey(userId),
          sk: getReadingListSortKey(bookId),
        },
      }),
    );
  }

  async listComments(
    bookId: string,
    request?: CommunityListRequest,
  ): Promise<CommunityListResult<CommentRecord>> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": getBookPartitionKey(bookId),
          ":skPrefix": "COMMENT#",
        },
      }),
    );

    const items = (response.Items ?? []) as CommentItem[];
    return paginateCommunityItems(
      items.map((item) => toCommentRecord(item)),
      request,
    );
  }

  async addComment(
    userId: string,
    userName: string,
    bookId: string,
    text: string,
  ): Promise<CommentRecord> {
    const createdAt = new Date().toISOString();
    const commentId = `comment:${randomUUID()}`;
    const item: CommentItem = {
      pk: getBookPartitionKey(bookId),
      sk: getCommentSortKey(commentId),
      entityType: "comment",
      id: commentId,
      bookId,
      userId,
      userName,
      text,
      createdAt,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );

    return toCommentRecord(item);
  }

  async removeComment(
    userId: string,
    bookId: string,
    commentId: string,
  ): Promise<boolean> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: getBookPartitionKey(bookId),
          sk: getCommentSortKey(commentId),
        },
      }),
    );

    const item = response.Item as CommentItem | undefined;

    if (!item || item.userId !== userId) {
      return false;
    }

    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: getBookPartitionKey(bookId),
          sk: getCommentSortKey(commentId),
        },
      }),
    );

    return true;
  }

  async getRatingSummary(
    bookId: string,
  ): Promise<{ averageRating: number; ratingCount: number }> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": getBookPartitionKey(bookId),
          ":skPrefix": "RATING#",
        },
      }),
    );

    const items = (response.Items ?? []) as RatingItem[];
    const ratingCount = items.length;
    const totalRating = items.reduce((sum, item) => sum + item.rating, 0);

    return {
      averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
      ratingCount,
    };
  }

  async getUserRating(userId: string, bookId: string): Promise<number> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: getBookPartitionKey(bookId),
          sk: getRatingSortKey(userId),
        },
      }),
    );

    const item = response.Item as RatingItem | undefined;
    return item?.rating ?? 0;
  }

  async setRating(userId: string, bookId: string, rating: number): Promise<void> {
    const createdAt = new Date().toISOString();

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: getBookPartitionKey(bookId),
          sk: getRatingSortKey(userId),
        },
        UpdateExpression: [
          "SET entityType = :entityType",
          "id = if_not_exists(id, :id)",
          "bookId = :bookId",
          "userId = :userId",
          "rating = :rating",
          "createdAt = if_not_exists(createdAt, :createdAt)",
        ].join(", "),
        ExpressionAttributeValues: {
          ":entityType": "rating",
          ":id": `rating:${userId}:${bookId}`,
          ":bookId": bookId,
          ":userId": userId,
          ":rating": rating,
          ":createdAt": createdAt,
        },
      }),
    );
  }

  async listReviews(
    bookId: string,
    request?: CommunityListRequest,
  ): Promise<CommunityListResult<ReviewRecord>> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": getBookPartitionKey(bookId),
          ":skPrefix": "REVIEW#",
        },
      }),
    );

    const items = (response.Items ?? []) as ReviewItem[];
    return paginateCommunityItems(
      items.map((item) => toReviewRecord(item)),
      request,
    );
  }

  async addReview(
    userId: string,
    userName: string,
    bookId: string,
    rating: number,
    review: string,
  ): Promise<ReviewRecord> {
    const createdAt = new Date().toISOString();
    const reviewId = `review:${randomUUID()}`;
    const item: ReviewItem = {
      pk: getBookPartitionKey(bookId),
      sk: getReviewSortKey(reviewId),
      entityType: "review",
      id: reviewId,
      bookId,
      userId,
      userName,
      rating,
      review,
      createdAt,
      helpful: 0,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );

    return toReviewRecord(item);
  }

  async removeReview(
    userId: string,
    bookId: string,
    reviewId: string,
  ): Promise<boolean> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: getBookPartitionKey(bookId),
          sk: getReviewSortKey(reviewId),
        },
      }),
    );

    const item = response.Item as ReviewItem | undefined;

    if (!item || item.userId !== userId) {
      return false;
    }

    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: getBookPartitionKey(bookId),
          sk: getReviewSortKey(reviewId),
        },
      }),
    );

    return true;
  }
}
