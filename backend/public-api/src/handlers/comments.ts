import { ok, serverError, type HttpResponse } from "../../../shared/http";
import { listCommentsForBook } from "../../../auth-api/src/services/bookCommunityService";

export async function getCommentsHandler(bookId: string): Promise<HttpResponse> {
  try {
    const comments = await listCommentsForBook(bookId);
    return ok({ comments });
  } catch (error) {
    console.error("Error listing comments:", error);
    return serverError("Unable to load comments.");
  }
}
