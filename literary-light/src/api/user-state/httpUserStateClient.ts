import {
  buildFavoriteRoute,
  buildReadingListRoute,
} from "@contracts/api";
import type {
  FavoritesResponse,
  ReadingListsResponse,
  UpsertReadingListRequest,
} from "@contracts/user-state";
import { fetchAuthSession } from "aws-amplify/auth";
import { getLocalAuthHeaders } from "@/api/auth/localSession";
import { runtimeConfig } from "@/config/runtime";
import type { UserStateClient, UpsertReadingListInput } from "./client";

class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
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
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const baseUrl = runtimeConfig.apiAuthBaseUrl;

  if (!baseUrl) {
    throw new Error("Authenticated API base URL is not configured.");
  }

  const authHeaders = await getAuthHeaders();
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

export class HttpUserStateClient implements UserStateClient {
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

  async listFavorites(_userId: string) {
    const response = await requestJson<FavoritesResponse>("/auth/favorites", {
      method: "GET",
    });

    return response.favorites;
  }

  async addFavorite(_userId: string, bookId: string): Promise<void> {
    await requestJson<void>(buildFavoriteRoute(bookId), {
      method: "PUT",
    });
    this.notify();
  }

  async removeFavorite(_userId: string, bookId: string): Promise<void> {
    await requestJson<void>(buildFavoriteRoute(bookId), {
      method: "DELETE",
    });
    this.notify();
  }

  async listReadingLists(_userId: string) {
    const response = await requestJson<ReadingListsResponse>("/auth/reading-lists", {
      method: "GET",
    });

    return response.readingLists;
  }

  async upsertReadingList(
    _userId: string,
    input: UpsertReadingListInput
  ): Promise<void> {
    const body: UpsertReadingListRequest = {
      bookId: input.bookId,
      listType: input.listType,
      ...(typeof input.progress === "number" ? { progress: input.progress } : {}),
      ...(typeof input.finishedAt !== "undefined"
        ? { finishedAt: input.finishedAt }
        : {}),
    };

    await requestJson<void>(buildReadingListRoute(input.bookId), {
      method: "PUT",
      body: JSON.stringify(body),
    });
    this.notify();
  }

  async removeReadingList(_userId: string, bookId: string): Promise<void> {
    await requestJson<void>(buildReadingListRoute(bookId), {
      method: "DELETE",
    });
    this.notify();
  }
}
