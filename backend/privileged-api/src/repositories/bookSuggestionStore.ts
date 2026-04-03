import type {
  BookSuggestionAuditEntry,
  BookSuggestionModerationStatus,
  BookSuggestionSubmission,
} from "../../../../contracts/book-suggestions";
import { getEnv } from "../../../shared/env";
import { DynamoBookSuggestionStore } from "./dynamoBookSuggestionStore";
import { LocalBookSuggestionStore } from "./localBookSuggestionStore";

export interface AcceptBookSuggestionSubmissionInput {
  submissionId: string;
  acceptedAt: string;
  acceptedByUserId: string;
  acceptedBookId: string;
  acceptedAuditEntryId: string;
  moderationNotes: string | null;
}

export interface ModerateBookSuggestionSubmissionInput {
  submissionId: string;
  status: Extract<BookSuggestionModerationStatus, "deferred" | "rejected">;
  moderatedAt: string;
  moderatedByUserId: string;
  moderationNotes: string;
  decisionAuditEntryId: string;
}

export interface BookSuggestionStore {
  appendEntry(entry: BookSuggestionAuditEntry): Promise<BookSuggestionAuditEntry>;
  createSubmission(
    submission: BookSuggestionSubmission,
  ): Promise<BookSuggestionSubmission>;
  listSubmissionsByStatus(
    status: BookSuggestionSubmission["status"],
  ): Promise<BookSuggestionSubmission[]>;
  getSubmissionById(submissionId: string): Promise<BookSuggestionSubmission | null>;
  markSubmissionAccepted(
    input: AcceptBookSuggestionSubmissionInput,
  ): Promise<BookSuggestionSubmission | null>;
  markSubmissionModerated(
    input: ModerateBookSuggestionSubmissionInput,
  ): Promise<BookSuggestionSubmission | null>;
}

function getStorageMode(): "dynamodb" | "file" {
  const appEnv = getEnv("APP_ENV") ?? "local";
  const hasTableName = Boolean(getEnv("BOOK_SUGGESTIONS_TABLE_NAME"));

  if (appEnv === "local" && !hasTableName) {
    return "file";
  }

  return "dynamodb";
}

let store: BookSuggestionStore | null = null;

export function getBookSuggestionStore(): BookSuggestionStore {
  if (store) {
    return store;
  }

  store = getStorageMode() === "file"
    ? new LocalBookSuggestionStore()
    : new DynamoBookSuggestionStore();

  return store;
}
