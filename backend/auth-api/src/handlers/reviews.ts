import type { CreateReviewRequest } from "../../../../contracts/user-state";
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
  addReviewForBook,
  removeReviewForBook,
} from "../services/bookCommunityService";

function normalizeRating(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  const normalized = Math.round(value);

  if (normalized < 1 || normalized > 5) {
    return null;
  }

  return normalized;
}

function normalizeReviewText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createReviewHandler(
  event: HttpEvent,
  bookId: string,
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  const body = parseJsonBody<CreateReviewRequest>(event);
  const rating = normalizeRating(body?.rating);
  const review = normalizeReviewText(body?.review);

  if (!rating) {
    return badRequest("A whole-number rating between 1 and 5 is required.");
  }

  if (!review) {
    return badRequest("A non-empty review is required.");
  }

  try {
    const createdReview = await addReviewForBook(
      user.id,
      user.name,
      bookId,
      rating,
      review,
    );
    return ok({ review: createdReview });
  } catch (error) {
    console.error("Error creating review:", error);
    return serverError("Unable to save review.");
  }
}

export async function deleteReviewHandler(
  event: HttpEvent,
  bookId: string,
  reviewId: string,
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    const deleted = await removeReviewForBook(user.id, bookId, reviewId);

    if (!deleted) {
      return forbidden("Only the author of a review can delete it.");
    }

    return noContent();
  } catch (error) {
    console.error("Error deleting review:", error);
    return serverError("Unable to delete review.");
  }
}
