import type { CreateCommentRequest } from "../../../../contracts/user-state";
import { communityPolicy } from "../../../../contracts/user-state";
import { getAuthenticatedUser } from "../../../shared/auth";
import {
  badRequest,
  forbidden,
  noContent,
  ok,
  parseJsonBody,
  serverError,
  unauthorized,
  type HttpEvent,
  type HttpResponse,
} from "../../../shared/http";
import {
  addCommentForBook,
  removeCommentForBook,
} from "../services/bookCommunityService";
import { validateCommentText } from "../lib/communityGuardrails";

export async function createCommentHandler(
  event: HttpEvent,
  bookId: string,
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  const body = parseJsonBody<CreateCommentRequest>(event);
  const text = validateCommentText(body?.text);

  if (!text) {
    return badRequest(
      `A non-empty comment up to ${communityPolicy.maxCommentLength} characters is required.`,
    );
  }

  try {
    const comment = await addCommentForBook(user.id, user.name, bookId, text);
    return ok({ comment });
  } catch (error) {
    console.error("Error creating comment:", error);
    return serverError("Unable to save comment.");
  }
}

export async function deleteCommentHandler(
  event: HttpEvent,
  bookId: string,
  commentId: string,
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    const deleted = await removeCommentForBook(user.id, bookId, commentId);

    if (!deleted) {
      return forbidden("Only the author of a comment can delete it.");
    }

    return noContent();
  } catch (error) {
    console.error("Error deleting comment:", error);
    return serverError("Unable to delete comment.");
  }
}
