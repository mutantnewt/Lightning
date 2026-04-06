import { LocalUserStateRepository } from "./localUserStateRepository";
import { UserStateRepository } from "./userStateRepository";
import { getEnv } from "../../../shared/env";
import type {
  CommunityListRequest,
  CommunityListResult,
} from "../lib/communityGuardrails";

export interface UserStateStore {
  listFavorites(userId: string): Promise<import("../../../../contracts/domain").FavoriteRecord[]>;
  addFavorite(userId: string, bookId: string): Promise<void>;
  removeFavorite(userId: string, bookId: string): Promise<void>;
  listReadingLists(userId: string): Promise<import("../../../../contracts/domain").ReadingListRecord[]>;
  upsertReadingList(
    userId: string,
    input: {
      bookId: string;
      listType: import("../../../../contracts/domain").ReadingListType;
      progress?: number;
      finishedAt?: string | null;
    },
  ): Promise<void>;
  removeReadingList(userId: string, bookId: string): Promise<void>;
  listComments(
    bookId: string,
    request?: CommunityListRequest,
  ): Promise<
    CommunityListResult<import("../../../../contracts/domain").CommentRecord>
  >;
  addComment(
    userId: string,
    userName: string,
    bookId: string,
    text: string,
  ): Promise<import("../../../../contracts/domain").CommentRecord>;
  removeComment(userId: string, bookId: string, commentId: string): Promise<boolean>;
  getRatingSummary(bookId: string): Promise<{ averageRating: number; ratingCount: number }>;
  getUserRating(userId: string, bookId: string): Promise<number>;
  setRating(userId: string, bookId: string, rating: number): Promise<void>;
  listReviews(
    bookId: string,
    request?: CommunityListRequest,
  ): Promise<
    CommunityListResult<import("../../../../contracts/domain").ReviewRecord>
  >;
  addReview(
    userId: string,
    userName: string,
    bookId: string,
    rating: number,
    review: string,
  ): Promise<import("../../../../contracts/domain").ReviewRecord>;
  removeReview(userId: string, bookId: string, reviewId: string): Promise<boolean>;
}

function getStorageMode(): "dynamodb" | "file" {
  const configuredMode = getEnv("USER_STATE_STORAGE_MODE");

  if (configuredMode === "dynamodb" || configuredMode === "file") {
    return configuredMode;
  }

  const appEnv = getEnv("APP_ENV") ?? "local";
  const hasTableName = Boolean(getEnv("USER_STATE_TABLE_NAME"));

  if (appEnv === "local" && !hasTableName) {
    return "file";
  }

  return "dynamodb";
}

let store: UserStateStore | null = null;

export function getUserStateStore(): UserStateStore {
  if (store) {
    return store;
  }

  store = getStorageMode() === "file"
    ? new LocalUserStateRepository()
    : new UserStateRepository();

  return store;
}
