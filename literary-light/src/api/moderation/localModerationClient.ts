import type {
  AcceptBookSuggestionResponse,
  BookSuggestionSubmission,
  ModerateBookSuggestionResponse,
} from "@contracts/book-suggestions";
import type { ModerationClient } from "./client";

export class LocalModerationClient implements ModerationClient {
  readonly mode = "local" as const;

  async listPendingSubmissions(): Promise<BookSuggestionSubmission[]> {
    return [];
  }

  async acceptSubmission(
    _submission: BookSuggestionSubmission,
    _moderationNotes?: string | null,
  ): Promise<AcceptBookSuggestionResponse> {
    throw new Error("Moderation requires the backend API to be configured.");
  }

  async deferSubmission(
    _submission: BookSuggestionSubmission,
    _moderationNotes: string,
  ): Promise<ModerateBookSuggestionResponse> {
    throw new Error("Moderation requires the backend API to be configured.");
  }

  async rejectSubmission(
    _submission: BookSuggestionSubmission,
    _moderationNotes: string,
  ): Promise<ModerateBookSuggestionResponse> {
    throw new Error("Moderation requires the backend API to be configured.");
  }
}
