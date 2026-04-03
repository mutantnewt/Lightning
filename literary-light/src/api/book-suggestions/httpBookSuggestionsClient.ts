import {
  buildBookSuggestionDetailsRoute,
  buildBookSuggestionSearchRoute,
  buildBookSuggestionSubmitRoute,
} from "@contracts/api";
import type {
  GetBookSuggestionDetailsRequest,
  GetBookSuggestionDetailsResponse,
  SearchBookSuggestionsRequest,
  SearchBookSuggestionsResponse,
  SubmitBookSuggestionRequest,
  SubmitBookSuggestionResponse,
} from "@contracts/book-suggestions";
import { fetchAuthSession } from "aws-amplify/auth";
import { getLocalAuthHeaders } from "@/api/auth/localSession";
import { runtimeConfig } from "@/config/runtime";
import type {
  BookSuggestionDetailsResponse as ClientBookSuggestionDetailsResponse,
  BookSuggestionSearchResponse as ClientBookSuggestionSearchResponse,
  BookSuggestionsClient,
  SearchBookSuggestionsInput,
} from "./client";

class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

async function getRequiredAuthHeaders(): Promise<Record<string, string>> {
  if (runtimeConfig.authMode === "local") {
    const headers = getLocalAuthHeaders();

    if (headers["x-lightning-local-user-id"]) {
      return headers;
    }

    throw new HttpError("Sign in to suggest books.", 401);
  }

  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    }
  } catch {
    // Fall through to the explicit auth error below.
  }

  throw new HttpError("Sign in to suggest books.", 401);
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl =
    runtimeConfig.apiPrivilegedBaseUrl ??
    runtimeConfig.apiAuthBaseUrl ??
    runtimeConfig.apiPublicBaseUrl;

  if (!baseUrl) {
    throw new Error("Privileged API base URL is not configured.");
  }

  const authHeaders = await getRequiredAuthHeaders();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const errorBody = (await response.json()) as { error?: string };
      if (errorBody.error) {
        message = errorBody.error;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }

    throw new HttpError(message, response.status);
  }

  return (await response.json()) as T;
}

export class HttpBookSuggestionsClient implements BookSuggestionsClient {
  readonly mode = "http" as const;

  async searchBooks(
    input: SearchBookSuggestionsInput,
  ): Promise<ClientBookSuggestionSearchResponse> {
    const body: SearchBookSuggestionsRequest = {
      ...(input.title ? { title: input.title } : {}),
      ...(input.author ? { author: input.author } : {}),
      ...(input.keyword ? { keyword: input.keyword } : {}),
      ...(input.existingBooks ? { existingBooks: input.existingBooks } : {}),
    };

    const response = await requestJson<SearchBookSuggestionsResponse>(
      buildBookSuggestionSearchRoute(),
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    return {
      results: response.results,
      auditEntryId: response.auditEntryId,
      source: response.source,
    };
  }

  async getBookDetails(
    title: string,
    author: string,
  ): Promise<ClientBookSuggestionDetailsResponse> {
    const body: GetBookSuggestionDetailsRequest = {
      title,
      author,
    };

    const response = await requestJson<GetBookSuggestionDetailsResponse>(
      buildBookSuggestionDetailsRoute(),
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    return {
      book: response.book,
      auditEntryId: response.auditEntryId,
      source: response.source,
    };
  }

  async submitBookSuggestion(
    book,
    sourceAuditEntryId?: string | null,
    source?: "openai" | "offline",
  ): Promise<SubmitBookSuggestionResponse> {
    const body: SubmitBookSuggestionRequest = {
      book,
      ...(source ? { source } : {}),
      ...(typeof sourceAuditEntryId !== "undefined"
        ? { sourceAuditEntryId }
        : {}),
    };

    return requestJson<SubmitBookSuggestionResponse>(
      buildBookSuggestionSubmitRoute(),
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }
}
