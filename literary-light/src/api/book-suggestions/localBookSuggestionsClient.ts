import type { Book } from "@/types";
import type {
  BookSearchResult,
  SubmitBookSuggestionResponse,
} from "@contracts/book-suggestions";
import {
  offlineBookSuggestionCatalog,
  type OfflineBookSuggestionEntry,
} from "@contracts/book-suggestions-seed";
import type {
  BookSuggestionDetailsResponse,
  BookSuggestionSearchResponse,
  BookSuggestionsClient,
  SearchBookSuggestionsInput,
} from "./client";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function toExistingBookKey(book: Pick<Book, "title" | "author">): string {
  return `${normalizeText(book.title)}::${normalizeText(book.author)}`;
}

function toSearchHaystack(entry: OfflineBookSuggestionEntry): string {
  return [
    entry.search.title,
    entry.search.author,
    entry.search.brief,
    entry.details.summary,
    entry.details.authorBio,
    entry.details.category,
    entry.details.era,
    entry.details.country,
    ...(entry.details.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterOfflineCatalog(input: SearchBookSuggestionsInput): BookSearchResult[] {
  const titleQuery = normalizeText(input.title);
  const authorQuery = normalizeText(input.author);
  const keywordQuery = normalizeText(input.keyword);
  const existingBookKeys = new Set((input.existingBooks ?? []).map(toExistingBookKey));

  return offlineBookSuggestionCatalog
    .filter((entry) => {
      const bookKey = `${normalizeText(entry.search.title)}::${normalizeText(entry.search.author)}`;

      if (existingBookKeys.has(bookKey)) {
        return false;
      }

      if (titleQuery && !normalizeText(entry.search.title).includes(titleQuery)) {
        return false;
      }

      if (authorQuery && !normalizeText(entry.search.author).includes(authorQuery)) {
        return false;
      }

      if (keywordQuery && !toSearchHaystack(entry).includes(keywordQuery)) {
        return false;
      }

      return true;
    })
    .slice(0, 10)
    .map((entry) => entry.search);
}

export class LocalBookSuggestionsClient implements BookSuggestionsClient {
  readonly mode = "local" as const;

  async searchBooks(
    input: SearchBookSuggestionsInput,
  ): Promise<BookSuggestionSearchResponse> {
    return {
      results: filterOfflineCatalog(input),
      auditEntryId: null,
      source: "offline",
    };
  }

  async getBookDetails(
    title: string,
    author: string,
  ): Promise<BookSuggestionDetailsResponse> {
    const match = offlineBookSuggestionCatalog.find(
      (entry) =>
        normalizeText(entry.search.title) === normalizeText(title) &&
        normalizeText(entry.search.author) === normalizeText(author),
    );

    if (!match) {
      throw new Error("We couldn't find offline details for that book.");
    }

    return {
      book: match.details,
      auditEntryId: null,
      source: "offline",
    };
  }

  async submitBookSuggestion(
    _book,
    sourceAuditEntryId?: string | null,
    _source?: "openai" | "offline",
  ): Promise<SubmitBookSuggestionResponse> {
    return {
      submitted: true,
      moderationStatus: "pending_review",
      submissionId: `book-suggestion-submission:offline:${Date.now()}`,
      auditEntryId: sourceAuditEntryId ?? `book-suggestion-audit:offline:${Date.now()}`,
    };
  }
}
