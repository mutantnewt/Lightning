import {
  badRequest,
  getQueryStringParameter,
  ok,
  serverError,
  type HttpEvent,
  type HttpResponse,
} from "../../../shared/http";
import {
  InvalidCommunityCursorError,
  normalizeCommunityPageSize,
} from "../../../auth-api/src/lib/communityGuardrails";
import { listReviewsForBook } from "../../../auth-api/src/services/bookCommunityService";

export async function getReviewsHandler(
  event: HttpEvent,
  bookId: string,
): Promise<HttpResponse> {
  const limit = normalizeCommunityPageSize(
    getQueryStringParameter(event, "limit"),
  );

  if (!limit) {
    return badRequest("A positive integer limit is required.");
  }

  try {
    const reviews = await listReviewsForBook(bookId, {
      limit,
      cursor: getQueryStringParameter(event, "cursor"),
    });
    return ok({
      reviews: reviews.items,
      nextCursor: reviews.nextCursor,
      hasMore: reviews.hasMore,
      pageSize: reviews.pageSize,
    });
  } catch (error) {
    if (error instanceof InvalidCommunityCursorError) {
      return badRequest(error.message);
    }

    console.error("Error listing reviews:", error);
    return serverError("Unable to load reviews.");
  }
}
