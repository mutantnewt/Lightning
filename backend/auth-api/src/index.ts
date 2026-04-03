import { authApiRoutes } from "../../../contracts/api";
import {
  badRequest,
  corsPreflight,
  getRequestMethod,
  getRequestPath,
  methodNotAllowed,
  notFound,
  type HttpEvent,
  type HttpResponse,
  withHttpEventContext,
} from "../../shared/http";
import {
  createCommentHandler,
  deleteCommentHandler,
} from "./handlers/comments";
import {
  deleteFavoriteHandler,
  listFavoritesHandler,
  putFavoriteHandler,
} from "./handlers/favorites";
import { getMeHandler } from "./handlers/getMe";
import { healthHandler } from "./handlers/health";
import {
  getUserRatingHandler,
  setRatingHandler,
} from "./handlers/ratings";
import {
  deleteReadingListHandler,
  listReadingListsHandler,
  upsertReadingListHandler,
} from "./handlers/readingLists";
import {
  createReviewHandler,
  deleteReviewHandler,
} from "./handlers/reviews";

function getTrailingParam(path: string, prefix: string): string | null {
  if (!path.startsWith(`${prefix}/`)) {
    return null;
  }

  const trailing = path.slice(prefix.length + 1);

  if (!trailing || trailing.includes("/")) {
    return null;
  }

  try {
    return decodeURIComponent(trailing);
  } catch {
    return null;
  }
}

function normalizeAuthPath(path: string): string {
  if (path.startsWith("/auth/")) {
    return path;
  }

  return path === "/health" || path === "/me" ? `/auth${path}` : path;
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
): { bookId: string; trailingSegments: string[] } | null {
  const segments = path.split("/").filter(Boolean);

  if (
    segments[0] !== "auth" ||
    segments[1] !== "books" ||
    segments[3] !== resource
  ) {
    return null;
  }

  const bookId = decodePathSegment(segments[2]);

  if (!bookId) {
    return null;
  }

  const trailingSegments: string[] = [];

  for (const segment of segments.slice(4)) {
    const decodedSegment = decodePathSegment(segment);

    if (!decodedSegment) {
      return null;
    }

    trailingSegments.push(decodedSegment);
  }

  return {
    bookId,
    trailingSegments,
  };
}

export async function handler(event: HttpEvent): Promise<HttpResponse> {
  return withHttpEventContext(event, async () => {
    const method = getRequestMethod(event);
    const path = normalizeAuthPath(getRequestPath(event));
    const commentRouteMatch = getBookRouteMatch(path, "comments");
    const ratingRouteMatch = getBookRouteMatch(path, "ratings");
    const reviewRouteMatch = getBookRouteMatch(path, "reviews");

    if (method === "OPTIONS") {
      if (path === authApiRoutes.health || path === authApiRoutes.me) {
        return corsPreflight(["GET", "OPTIONS"]);
      }

      if (path === authApiRoutes.favorites || path === authApiRoutes.readingLists) {
        return corsPreflight(["GET", "OPTIONS"]);
      }

      if (
        path.startsWith(`${authApiRoutes.favorites}/`) ||
        path.startsWith(`${authApiRoutes.readingLists}/`)
      ) {
        return corsPreflight(["PUT", "DELETE", "OPTIONS"]);
      }

      if (commentRouteMatch) {
        return commentRouteMatch.trailingSegments.length === 0
          ? corsPreflight(["POST", "OPTIONS"])
          : corsPreflight(["DELETE", "OPTIONS"]);
      }

      if (ratingRouteMatch) {
        return ratingRouteMatch.trailingSegments[0] === "me"
          ? corsPreflight(["GET", "OPTIONS"])
          : corsPreflight(["PUT", "OPTIONS"]);
      }

      if (reviewRouteMatch) {
        return reviewRouteMatch.trailingSegments.length === 0
          ? corsPreflight(["POST", "OPTIONS"])
          : corsPreflight(["DELETE", "OPTIONS"]);
      }
    }

    if (path === authApiRoutes.health) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return healthHandler();
    }

    if (path === authApiRoutes.me) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return getMeHandler(event);
    }

    if (path === authApiRoutes.favorites) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return await listFavoritesHandler(event);
    }

    const favoriteBookId = getTrailingParam(path, authApiRoutes.favorites);
    if (favoriteBookId) {
      if (method === "PUT") {
        return await putFavoriteHandler(event, favoriteBookId);
      }

      if (method === "DELETE") {
        return await deleteFavoriteHandler(event, favoriteBookId);
      }

      return methodNotAllowed(["PUT", "DELETE"]);
    }

    if (path === authApiRoutes.readingLists) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return await listReadingListsHandler(event);
    }

    const readingListBookId = getTrailingParam(path, authApiRoutes.readingLists);
    if (readingListBookId) {
      if (method === "PUT") {
        return await upsertReadingListHandler(event, readingListBookId);
      }

      if (method === "DELETE") {
        return await deleteReadingListHandler(event, readingListBookId);
      }

      return methodNotAllowed(["PUT", "DELETE"]);
    }

    if (
      path.startsWith(`${authApiRoutes.favorites}/`) ||
      path.startsWith(`${authApiRoutes.readingLists}/`)
    ) {
      return badRequest(`Malformed authenticated route path: ${path}`);
    }

    if (commentRouteMatch) {
      if (commentRouteMatch.trailingSegments.length === 0) {
        if (method !== "POST") {
          return methodNotAllowed(["POST"]);
        }

        return await createCommentHandler(event, commentRouteMatch.bookId);
      }

      if (commentRouteMatch.trailingSegments.length === 1) {
        if (method !== "DELETE") {
          return methodNotAllowed(["DELETE"]);
        }

        const commentId = commentRouteMatch.trailingSegments[0];

        if (!commentId) {
          return badRequest(`Malformed authenticated route path: ${path}`);
        }

        return await deleteCommentHandler(
          event,
          commentRouteMatch.bookId,
          commentId,
        );
      }

      return badRequest(`Malformed authenticated route path: ${path}`);
    }

    if (ratingRouteMatch) {
      if (
        ratingRouteMatch.trailingSegments.length === 1 &&
        ratingRouteMatch.trailingSegments[0] === "me"
      ) {
        if (method !== "GET") {
          return methodNotAllowed(["GET"]);
        }

        return await getUserRatingHandler(event, ratingRouteMatch.bookId);
      }

      if (ratingRouteMatch.trailingSegments.length === 0) {
        if (method !== "PUT") {
          return methodNotAllowed(["PUT"]);
        }

        return await setRatingHandler(event, ratingRouteMatch.bookId);
      }

      return badRequest(`Malformed authenticated route path: ${path}`);
    }

    if (reviewRouteMatch) {
      if (reviewRouteMatch.trailingSegments.length === 0) {
        if (method !== "POST") {
          return methodNotAllowed(["POST"]);
        }

        return await createReviewHandler(event, reviewRouteMatch.bookId);
      }

      if (reviewRouteMatch.trailingSegments.length === 1) {
        if (method !== "DELETE") {
          return methodNotAllowed(["DELETE"]);
        }

        const reviewId = reviewRouteMatch.trailingSegments[0];

        if (!reviewId) {
          return badRequest(`Malformed authenticated route path: ${path}`);
        }

        return await deleteReviewHandler(
          event,
          reviewRouteMatch.bookId,
          reviewId,
        );
      }

      return badRequest(`Malformed authenticated route path: ${path}`);
    }

    return notFound(`No authenticated route is registered for ${method} ${path}`);
  });
}
