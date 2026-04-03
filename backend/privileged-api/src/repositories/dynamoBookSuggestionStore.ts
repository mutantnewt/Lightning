import {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  BookSuggestionAuditEntry,
  BookSuggestionSubmission,
} from "../../../../contracts/book-suggestions";
import { getDynamoDocumentClient } from "../../../shared/dynamo";
import { getRequiredEnv } from "../../../shared/env";
import type {
  AcceptBookSuggestionSubmissionInput,
  BookSuggestionStore,
  ModerateBookSuggestionSubmissionInput,
} from "./bookSuggestionStore";

interface BookSuggestionAuditItem extends BookSuggestionAuditEntry {
  pk: string;
  sk: string;
  entityType: "bookSuggestionAudit";
}

interface BookSuggestionSubmissionItem extends BookSuggestionSubmission {
  pk: string;
  sk: "META";
  entityType: "bookSuggestionSubmission";
}

function toSubmissionKey(submissionId: string): Pick<BookSuggestionSubmissionItem, "pk" | "sk"> {
  return {
    pk: `SUBMISSION#${submissionId}`,
    sk: "META",
  };
}

export class DynamoBookSuggestionStore implements BookSuggestionStore {
  private readonly client = getDynamoDocumentClient();
  private readonly tableName = getRequiredEnv("BOOK_SUGGESTIONS_TABLE_NAME");

  async appendEntry(
    entry: BookSuggestionAuditEntry,
  ): Promise<BookSuggestionAuditEntry> {
    const item: BookSuggestionAuditItem = {
      pk: `AUDIT#${entry.id}`,
      sk: `STAGE#${entry.stage}#${entry.createdAt}`,
      entityType: "bookSuggestionAudit",
      ...entry,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );

    return entry;
  }

  async createSubmission(
    submission: BookSuggestionSubmission,
  ): Promise<BookSuggestionSubmission> {
    const item: BookSuggestionSubmissionItem = {
      ...toSubmissionKey(submission.id),
      entityType: "bookSuggestionSubmission",
      ...submission,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      }),
    );

    return submission;
  }

  async listSubmissionsByStatus(
    status: BookSuggestionSubmission["status"],
  ): Promise<BookSuggestionSubmission[]> {
    const response = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "entityType = :entityType AND #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":entityType": "bookSuggestionSubmission",
          ":status": status,
        },
      }),
    );

    return (response.Items ?? [])
      .map((item) => item as BookSuggestionSubmissionItem)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getSubmissionById(
    submissionId: string,
  ): Promise<BookSuggestionSubmission | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: toSubmissionKey(submissionId),
      }),
    );

    return (response.Item as BookSuggestionSubmissionItem | undefined) ?? null;
  }

  async markSubmissionAccepted(
    input: AcceptBookSuggestionSubmissionInput,
  ): Promise<BookSuggestionSubmission | null> {
    const current = await this.getSubmissionById(input.submissionId);

    if (!current) {
      return null;
    }

    const response = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: toSubmissionKey(input.submissionId),
        UpdateExpression: [
          "SET #status = :status",
          "updatedAt = :updatedAt",
          "moderationNotes = :moderationNotes",
          "lastModeratedAt = :lastModeratedAt",
          "lastModeratedByUserId = :lastModeratedByUserId",
          "decisionAuditEntryId = :decisionAuditEntryId",
          "acceptedAt = :acceptedAt",
          "acceptedByUserId = :acceptedByUserId",
          "acceptedBookId = :acceptedBookId",
          "acceptedAuditEntryId = :acceptedAuditEntryId",
        ].join(", "),
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": "accepted",
          ":updatedAt": input.acceptedAt,
          ":moderationNotes": input.moderationNotes,
          ":lastModeratedAt": input.acceptedAt,
          ":lastModeratedByUserId": input.acceptedByUserId,
          ":decisionAuditEntryId": input.acceptedAuditEntryId,
          ":acceptedAt": input.acceptedAt,
          ":acceptedByUserId": input.acceptedByUserId,
          ":acceptedBookId": input.acceptedBookId,
          ":acceptedAuditEntryId": input.acceptedAuditEntryId,
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return (response.Attributes as BookSuggestionSubmissionItem | undefined) ?? current;
  }

  async markSubmissionModerated(
    input: ModerateBookSuggestionSubmissionInput,
  ): Promise<BookSuggestionSubmission | null> {
    const current = await this.getSubmissionById(input.submissionId);

    if (!current) {
      return null;
    }

    const response = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: toSubmissionKey(input.submissionId),
        UpdateExpression: [
          "SET #status = :status",
          "updatedAt = :updatedAt",
          "moderationNotes = :moderationNotes",
          "lastModeratedAt = :lastModeratedAt",
          "lastModeratedByUserId = :lastModeratedByUserId",
          "decisionAuditEntryId = :decisionAuditEntryId",
          "acceptedAt = :acceptedAt",
          "acceptedByUserId = :acceptedByUserId",
          "acceptedBookId = :acceptedBookId",
          "acceptedAuditEntryId = :acceptedAuditEntryId",
        ].join(", "),
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": input.status,
          ":updatedAt": input.moderatedAt,
          ":moderationNotes": input.moderationNotes,
          ":lastModeratedAt": input.moderatedAt,
          ":lastModeratedByUserId": input.moderatedByUserId,
          ":decisionAuditEntryId": input.decisionAuditEntryId,
          ":acceptedAt": null,
          ":acceptedByUserId": null,
          ":acceptedBookId": null,
          ":acceptedAuditEntryId": null,
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return (response.Attributes as BookSuggestionSubmissionItem | undefined) ?? current;
  }
}
