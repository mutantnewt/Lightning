import {
  buildAuthBookCommentsRoute,
  buildAuthBookRatingsRoute,
  buildAuthBookUserRatingRoute,
  buildAuthBookReviewsRoute,
  buildCommentRoute,
  buildPublicBookCommentsRoute,
  buildPublicBookRatingsRoute,
  buildPublicBookReviewsRoute,
  buildReviewRoute,
} from "@contracts/api";
import type {
  CommentRecord,
  ReviewRecord,
} from "@contracts/domain";
import type {
  CommentsResponse,
  CreateCommentRequest,
  CreateReviewRequest,
  RatingsSummaryResponse,
  ReviewsResponse,
  SetRatingRequest,
  UserRatingResponse,
} from "@contracts/user-state";
import { fetchAuthSession } from "aws-amplify/auth";
import { getLocalAuthHeaders } from "@/api/auth/localSession";
import { runtimeConfig } from "@/config/runtime";
import type { CommunityClient, RatingSummary } from "./client";

class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

function getPublicBaseUrl(): string {
  const baseUrl = runtimeConfig.apiPublicBaseUrl ?? runtimeConfig.apiAuthBaseUrl;

  if (!baseUrl) {
    throw new Error("Public API base URL is not configured.");
  }

  return baseUrl;
}

function getAuthBaseUrl(): string {
  const baseUrl = runtimeConfig.apiAuthBaseUrl ?? runtimeConfig.apiPublicBaseUrl;

  if (!baseUrl) {
    throw new Error("Authenticated API base URL is not configured.");
  }

  return baseUrl;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (runtimeConfig.authMode === "local") {
    const headers = getLocalAuthHeaders();

    if (!headers["x-lightning-local-user-id"]) {
      throw new Error("Authentication required.");
    }

    return headers;
  }

  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("Authentication required.");
  }

  return {
    Authorization: `Bearer ${idToken}`,
  };
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  authRequired = false,
): Promise<T> {
  const authHeaders = authRequired ? await getAuthHeaders() : {};
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
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

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export class HttpCommunityClient implements CommunityClient {
  readonly mode = "http" as const;

  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  async listComments(bookId: string): Promise<CommentRecord[]> {
    const response = await requestJson<CommentsResponse>(
      getPublicBaseUrl(),
      buildPublicBookCommentsRoute(bookId),
      { method: "GET" },
    );

    return response.comments;
  }

  async addComment(
    bookId: string,
    _userId: string,
    _userName: string,
    text: string,
  ): Promise<CommentRecord> {
    const body: CreateCommentRequest = { text };
    const response = await requestJson<{ comment: CommentRecord }>(
      getAuthBaseUrl(),
      buildAuthBookCommentsRoute(bookId),
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true,
    );
    this.notify();
    return response.comment;
  }

  async deleteComment(
    bookId: string,
    commentId: string,
    _userId: string,
  ): Promise<boolean> {
    try {
      await requestJson<void>(
        getAuthBaseUrl(),
        buildCommentRoute(bookId, commentId),
        { method: "DELETE" },
        true,
      );
      this.notify();
      return true;
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 403) {
        return false;
      }

      throw error;
    }
  }

  async getRatingSummary(bookId: string): Promise<RatingSummary> {
    return requestJson<RatingsSummaryResponse>(
      getPublicBaseUrl(),
      buildPublicBookRatingsRoute(bookId),
      { method: "GET" },
    );
  }

  async getUserRating(bookId: string, _userId: string): Promise<number> {
    const response = await requestJson<UserRatingResponse>(
      getAuthBaseUrl(),
      buildAuthBookUserRatingRoute(bookId),
      { method: "GET" },
      true,
    );

    return response.rating;
  }

  async setRating(
    bookId: string,
    _userId: string,
    rating: number,
  ): Promise<void> {
    const body: SetRatingRequest = { rating };
    await requestJson<void>(
      getAuthBaseUrl(),
      buildAuthBookRatingsRoute(bookId),
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
      true,
    );
    this.notify();
  }

  async listReviews(bookId: string): Promise<ReviewRecord[]> {
    const response = await requestJson<ReviewsResponse>(
      getPublicBaseUrl(),
      buildPublicBookReviewsRoute(bookId),
      { method: "GET" },
    );

    return response.reviews;
  }

  async addReview(
    bookId: string,
    _userId: string,
    _userName: string,
    rating: number,
    review: string,
  ): Promise<ReviewRecord> {
    const body: CreateReviewRequest = { rating, review };
    const response = await requestJson<{ review: ReviewRecord }>(
      getAuthBaseUrl(),
      buildAuthBookReviewsRoute(bookId),
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true,
    );
    this.notify();
    return response.review;
  }

  async deleteReview(
    bookId: string,
    reviewId: string,
    _userId: string,
  ): Promise<boolean> {
    try {
      await requestJson<void>(
        getAuthBaseUrl(),
        buildReviewRoute(bookId, reviewId),
        { method: "DELETE" },
        true,
      );
      this.notify();
      return true;
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 403) {
        return false;
      }

      throw error;
    }
  }
}
