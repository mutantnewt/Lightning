import { publicApiRoutes } from "../../../contracts/api";
import {
  corsPreflight,
  getRequestMethod,
  getRequestPath,
  methodNotAllowed,
  notFound,
  type HttpEvent,
  type HttpResponse,
  withHttpEventContext,
} from "../../shared/http";
import { getAuthorBooksHandler } from "./handlers/getAuthorBooks";
import { getCommentsHandler } from "./handlers/comments";
import { getBooksHandler } from "./handlers/getBooks";
import { getFaqHandler } from "./handlers/getFaq";
import { healthHandler } from "./handlers/health";
import { getRatingsHandler } from "./handlers/ratings";
import { getReviewsHandler } from "./handlers/reviews";

function normalizePublicPath(path: string): string {
  if (path.startsWith("/public/")) {
    return path;
  }

  return path === "/health" || path === "/books" || path === "/faq"
    ? `/public${path}`
    : path;
}

function decodePathSegment(segment: string | undefined): string | null {
  if (!segment) {
    return null;
  }

  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function getBookRouteMatch(
  path: string,
  resource: "comments" | "ratings" | "reviews",
): { bookId: string } | null {
  const segments = path.split("/").filter(Boolean);

  if (
    segments[0] !== "public" ||
    segments[1] !== "books" ||
    segments[3] !== resource ||
    segments.length !== 4
  ) {
    return null;
  }

  const bookId = decodePathSegment(segments[2]);

  if (!bookId) {
    return null;
  }

  return { bookId };
}

function getAuthorBooksRouteMatch(path: string): { authorName: string } | null {
  const segments = path.split("/").filter(Boolean);

  if (
    segments[0] !== "public" ||
    segments[1] !== "authors" ||
    segments[3] !== "books" ||
    segments.length !== 4
  ) {
    return null;
  }

  const authorName = decodePathSegment(segments[2]);

  if (!authorName) {
    return null;
  }

  return { authorName };
}

export async function handler(event: HttpEvent): Promise<HttpResponse> {
  return withHttpEventContext(event, async () => {
    const method = getRequestMethod(event);
    const path = normalizePublicPath(getRequestPath(event));
    const commentRouteMatch = getBookRouteMatch(path, "comments");
    const ratingRouteMatch = getBookRouteMatch(path, "ratings");
    const reviewRouteMatch = getBookRouteMatch(path, "reviews");
    const authorBooksRouteMatch = getAuthorBooksRouteMatch(path);

    if (method === "OPTIONS") {
      if (
        path === publicApiRoutes.health ||
        path === publicApiRoutes.books ||
        path === publicApiRoutes.faq ||
        authorBooksRouteMatch ||
        commentRouteMatch ||
        ratingRouteMatch ||
        reviewRouteMatch
      ) {
        return corsPreflight(["GET", "OPTIONS"]);
      }
    }

    if (path === publicApiRoutes.health) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return healthHandler();
    }

    if (path === publicApiRoutes.books) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return getBooksHandler();
    }

    if (path === publicApiRoutes.faq) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return getFaqHandler();
    }

    if (authorBooksRouteMatch) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return getAuthorBooksHandler(authorBooksRouteMatch.authorName);
    }

    if (commentRouteMatch) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return getCommentsHandler(commentRouteMatch.bookId);
    }

    if (ratingRouteMatch) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return getRatingsHandler(ratingRouteMatch.bookId);
    }

    if (reviewRouteMatch) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return getReviewsHandler(reviewRouteMatch.bookId);
    }

    return notFound(`No public route is registered for ${method} ${path}`);
  });
}
