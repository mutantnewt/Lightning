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
import { listCommentsForBook } from "../../../auth-api/src/services/bookCommunityService";

export async function getCommentsHandler(
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
    const comments = await listCommentsForBook(bookId, {
      limit,
      cursor: getQueryStringParameter(event, "cursor"),
    });
    return ok({
      comments: comments.items,
      nextCursor: comments.nextCursor,
      hasMore: comments.hasMore,
      pageSize: comments.pageSize,
    });
  } catch (error) {
    if (error instanceof InvalidCommunityCursorError) {
      return badRequest(error.message);
    }

    console.error("Error listing comments:", error);
    return serverError("Unable to load comments.");
  }
}
