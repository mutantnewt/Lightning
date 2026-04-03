import type {
  AcceptBookSuggestionResponse,
  BookSuggestionSubmission,
  ModerateBookSuggestionResponse,
} from "@contracts/book-suggestions";

export interface ModerationClient {
  readonly mode: "local" | "http";
  listPendingSubmissions(): Promise<BookSuggestionSubmission[]>;
  acceptSubmission(
    submission: BookSuggestionSubmission,
    moderationNotes?: string | null,
  ): Promise<AcceptBookSuggestionResponse>;
  deferSubmission(
    submission: BookSuggestionSubmission,
    moderationNotes: string,
  ): Promise<ModerateBookSuggestionResponse>;
  rejectSubmission(
    submission: BookSuggestionSubmission,
    moderationNotes: string,
  ): Promise<ModerateBookSuggestionResponse>;
}
