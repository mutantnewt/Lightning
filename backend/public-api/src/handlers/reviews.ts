import { ok, serverError, type HttpResponse } from "../../../shared/http";
import { listReviewsForBook } from "../../../auth-api/src/services/bookCommunityService";

export async function getReviewsHandler(bookId: string): Promise<HttpResponse> {
  try {
    const reviews = await listReviewsForBook(bookId);
    return ok({ reviews });
  } catch (error) {
    console.error("Error listing reviews:", error);
    return serverError("Unable to load reviews.");
  }
}
