import {
  buildAuthorBooksRoute,
  buildCatalogBooksRoute,
  publicApiRoutes,
} from "@contracts/api";
import type {
  BooksResponse,
  CreateCatalogBookRequest,
  CreateCatalogBookResponse,
  FaqEntriesResponse,
} from "@contracts/catalog";
import type { CatalogClient } from "./client";
import { runtimeConfig } from "@/config/runtime";

class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl =
    runtimeConfig.apiPrivilegedBaseUrl ??
    runtimeConfig.apiPublicBaseUrl ??
    runtimeConfig.apiAuthBaseUrl;

  if (!baseUrl) {
    throw new Error("Catalog API base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? "GET",
    body: init?.body,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
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

export class HttpCatalogClient implements CatalogClient {
  readonly mode = "http" as const;

  async listBooks() {
    const response = await requestJson<BooksResponse>(publicApiRoutes.books);
    return response.books;
  }

  async listFaqEntries() {
    const response = await requestJson<FaqEntriesResponse>(publicApiRoutes.faq);
    return response.faqEntries;
  }

  async listBooksByAuthor(authorName: string) {
    const response = await requestJson<BooksResponse>(buildAuthorBooksRoute(authorName));
    return response.books;
  }

  async createBook(book, sourceAuditEntryId?: string | null) {
    const body: CreateCatalogBookRequest = {
      book,
      ...(typeof sourceAuditEntryId !== "undefined"
        ? { sourceAuditEntryId }
        : {}),
    };

    const response = await requestJson<CreateCatalogBookResponse>(
      buildCatalogBooksRoute(),
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    return response.book;
  }
}
