import type { AuthUser } from "./auth";
import type { Book } from "./domain";

export interface ExistingBookReference {
  title: string;
  author: string;
  year?: number | null;
}

export interface BookSearchResult {
  title: string;
  author: string;
  year: number | null;
  brief: string;
}

export interface SearchBookSuggestionsRequest {
  title?: string;
  author?: string;
  keyword?: string;
  existingBooks?: ExistingBookReference[];
}

export interface SearchBookSuggestionsResponse {
  results: BookSearchResult[];
  auditEntryId: string | null;
  source: "openai" | "offline";
}

export interface GetBookSuggestionDetailsRequest {
  title: string;
  author: string;
}

export interface GetBookSuggestionDetailsResponse {
  book: Partial<Book>;
  auditEntryId: string | null;
  source: "openai" | "offline";
}

export interface AcceptBookSuggestionRequest {
  submissionId?: string | null;
  book: Partial<Book>;
  sourceAuditEntryId?: string | null;
  moderationNotes?: string | null;
}

export interface SubmitBookSuggestionRequest {
  book: Partial<Book>;
  source?: "openai" | "offline";
  sourceAuditEntryId?: string | null;
}

export interface SubmitBookSuggestionResponse {
  submitted: true;
  moderationStatus: "pending_review";
  submissionId: string;
  auditEntryId: string;
}

export interface ModerateBookSuggestionRequest {
  submissionId: string;
  moderationNotes: string;
}

export interface ModerateBookSuggestionResponse {
  moderated: true;
  moderationStatus: "deferred" | "rejected";
  submissionId: string;
  auditEntryId: string;
}

export interface ListBookSuggestionSubmissionsResponse {
  submissions: BookSuggestionSubmission[];
}

export interface AcceptBookSuggestionResponse {
  accepted: true;
  moderationStatus: "accepted";
  submissionId: string | null;
  auditEntryId: string;
  book: Book;
}

export type BookSuggestionModerationStatus =
  | "pending_review"
  | "accepted"
  | "deferred"
  | "rejected";

export interface BookSuggestionAuditEntry {
  id: string;
  stage: "search" | "details" | "submit" | "accept" | "defer" | "reject";
  source: "openai" | "offline";
  createdAt: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface BookSuggestionSubmission {
  id: string;
  status: BookSuggestionModerationStatus;
  source: "openai" | "offline";
  createdAt: string;
  updatedAt: string;
  sourceAuditEntryId: string | null;
  book: Partial<Book>;
  requestedBy: Pick<AuthUser, "id" | "username" | "email" | "name">;
  moderationNotes: string | null;
  lastModeratedAt: string | null;
  lastModeratedByUserId: string | null;
  decisionAuditEntryId: string | null;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  acceptedBookId: string | null;
  acceptedAuditEntryId: string | null;
}
