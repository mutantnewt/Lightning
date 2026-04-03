import { ok, serverError, type HttpResponse } from "../../../shared/http";
import { getRatingSummaryForBook } from "../../../auth-api/src/services/bookCommunityService";

export async function getRatingsHandler(bookId: string): Promise<HttpResponse> {
  try {
    const summary = await getRatingSummaryForBook(bookId);
    return ok(summary);
  } catch (error) {
    console.error("Error loading rating summary:", error);
    return serverError("Unable to load ratings.");
  }
}
