import {
  allowLocalRuntimeFallbacks,
  createFailClosedError,
  runtimeConfig,
} from "@/config/runtime";
import type { BookSuggestionsClient } from "./client";
import { HttpBookSuggestionsClient } from "./httpBookSuggestionsClient";
import { LocalBookSuggestionsClient } from "./localBookSuggestionsClient";

export type {
  BookSuggestionDetailsResponse,
  BookSuggestionSearchResponse,
  BookSuggestionsClient,
  SearchBookSuggestionsInput,
} from "./client";

class DisabledBookSuggestionsClient implements BookSuggestionsClient {
  readonly mode = "disabled" as const;

  async searchBooks(): Promise<never> {
    throw createFailClosedError("Add Book services");
  }

  async getBookDetails(): Promise<never> {
    throw createFailClosedError("Add Book services");
  }

  async submitBookSuggestion(): Promise<never> {
    throw createFailClosedError("Add Book services");
  }
}

export function createBookSuggestionsClient(): BookSuggestionsClient {
  if (
    runtimeConfig.apiPrivilegedBaseUrl ||
    runtimeConfig.apiAuthBaseUrl ||
    runtimeConfig.apiPublicBaseUrl
  ) {
    return new HttpBookSuggestionsClient();
  }

  if (allowLocalRuntimeFallbacks()) {
    return new LocalBookSuggestionsClient();
  }

  return new DisabledBookSuggestionsClient();
}
