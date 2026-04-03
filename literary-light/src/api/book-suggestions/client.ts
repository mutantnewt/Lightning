import type { Book } from "@/types";
import type {
  BookSearchResult,
  SubmitBookSuggestionResponse,
} from "@contracts/book-suggestions";

export interface SearchBookSuggestionsInput {
  title?: string;
  author?: string;
  keyword?: string;
  existingBooks?: Array<Pick<Book, "title" | "author" | "year">>;
}

export interface BookSuggestionSearchResponse {
  results: BookSearchResult[];
  auditEntryId: string | null;
  source: "openai" | "offline";
}

export interface BookSuggestionDetailsResponse {
  book: Partial<Book>;
  auditEntryId: string | null;
  source: "openai" | "offline";
}

export interface BookSuggestionsClient {
  readonly mode: "local" | "http";
  searchBooks(input: SearchBookSuggestionsInput): Promise<BookSuggestionSearchResponse>;
  getBookDetails(title: string, author: string): Promise<BookSuggestionDetailsResponse>;
  submitBookSuggestion(
    book: Partial<Book>,
    sourceAuditEntryId?: string | null,
    source?: "openai" | "offline",
  ): Promise<SubmitBookSuggestionResponse>;
}
