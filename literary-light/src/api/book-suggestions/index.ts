import { runtimeConfig } from "@/config/runtime";
import type { BookSuggestionsClient } from "./client";
import { HttpBookSuggestionsClient } from "./httpBookSuggestionsClient";
import { LocalBookSuggestionsClient } from "./localBookSuggestionsClient";

export type {
  BookSuggestionDetailsResponse,
  BookSuggestionSearchResponse,
  BookSuggestionsClient,
  SearchBookSuggestionsInput,
} from "./client";

export function createBookSuggestionsClient(): BookSuggestionsClient {
  if (
    runtimeConfig.apiPrivilegedBaseUrl ||
    runtimeConfig.apiAuthBaseUrl ||
    runtimeConfig.apiPublicBaseUrl
  ) {
    return new HttpBookSuggestionsClient();
  }

  return new LocalBookSuggestionsClient();
}
