import {
  buildBookSuggestionAcceptRoute,
  buildBookSuggestionDeferRoute,
  buildBookSuggestionRejectRoute,
  buildBookSuggestionSubmissionsRoute,
} from "@contracts/api";
import type {
  AcceptBookSuggestionRequest,
  AcceptBookSuggestionResponse,
  BookSuggestionSubmission,
  ListBookSuggestionSubmissionsResponse,
  ModerateBookSuggestionRequest,
  ModerateBookSuggestionResponse,
} from "@contracts/book-suggestions";
import { fetchAuthSession } from "aws-amplify/auth";
import { getLocalAuthHeaders } from "@/api/auth/localSession";
import {
  allowLocalRuntimeFallbacks,
  createFailClosedError,
  runtimeConfig,
} from "@/config/runtime";
import type { ModerationClient } from "./client";

class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

async function getRequiredAuthHeaders(): Promise<Record<string, string>> {
  if (runtimeConfig.authMode === "disabled") {
    throw createFailClosedError("Authentication");
  }

  if (runtimeConfig.authMode === "local" && allowLocalRuntimeFallbacks()) {
    const headers = getLocalAuthHeaders();

    if (headers["x-lightning-local-user-id"]) {
      return headers;
    }

    throw new HttpError("Sign in to access moderation.", 401);
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

  throw new HttpError("Sign in to access moderation.", 401);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl =
    runtimeConfig.apiPrivilegedBaseUrl ??
    runtimeConfig.apiAuthBaseUrl ??
    runtimeConfig.apiPublicBaseUrl;

  if (!baseUrl) {
    throw createFailClosedError("Moderation services");
  }

  const authHeaders = await getRequiredAuthHeaders();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const errorBody = (await response.json()) as { error?: string; message?: string };
      if (errorBody.error || errorBody.message) {
        message = errorBody.error ?? errorBody.message ?? message;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }

    throw new HttpError(message, response.status);
  }

  return (await response.json()) as T;
}

export class HttpModerationClient implements ModerationClient {
  readonly mode = "http" as const;

  async listPendingSubmissions(): Promise<BookSuggestionSubmission[]> {
    const response = await requestJson<ListBookSuggestionSubmissionsResponse>(
      buildBookSuggestionSubmissionsRoute("pending_review"),
      {
        method: "GET",
      },
    );

    return response.submissions;
  }

  async acceptSubmission(
    submission: BookSuggestionSubmission,
    moderationNotes?: string | null,
  ): Promise<AcceptBookSuggestionResponse> {
    const body: AcceptBookSuggestionRequest = {
      submissionId: submission.id,
      book: submission.book,
      sourceAuditEntryId: submission.sourceAuditEntryId,
      moderationNotes: moderationNotes ?? null,
    };

    return requestJson<AcceptBookSuggestionResponse>(buildBookSuggestionAcceptRoute(), {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deferSubmission(
    submission: BookSuggestionSubmission,
    moderationNotes: string,
  ): Promise<ModerateBookSuggestionResponse> {
    const body: ModerateBookSuggestionRequest = {
      submissionId: submission.id,
      moderationNotes,
    };

    return requestJson<ModerateBookSuggestionResponse>(buildBookSuggestionDeferRoute(), {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async rejectSubmission(
    submission: BookSuggestionSubmission,
    moderationNotes: string,
  ): Promise<ModerateBookSuggestionResponse> {
    const body: ModerateBookSuggestionRequest = {
      submissionId: submission.id,
      moderationNotes,
    };

    return requestJson<ModerateBookSuggestionResponse>(buildBookSuggestionRejectRoute(), {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}
