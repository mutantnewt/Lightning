import type { SetRatingRequest } from "../../../../contracts/user-state";
import { getAuthenticatedUser } from "../../../shared/auth";
import {
  badRequest,
  noContent,
  ok,
  parseJsonBody,
  serverError,
  unauthorized,
  type HttpEvent,
  type HttpResponse,
} from "../../../shared/http";
import {
  getUserRatingForBook,
  setRatingForBook,
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

export async function getUserRatingHandler(
  event: HttpEvent,
  bookId: string,
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    const rating = await getUserRatingForBook(user.id, bookId);
    return ok({ rating });
  } catch (error) {
    console.error("Error loading user rating:", error);
    return serverError("Unable to load your rating.");
  }
}

export async function setRatingHandler(
  event: HttpEvent,
  bookId: string,
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  const body = parseJsonBody<SetRatingRequest>(event);
  const rating = normalizeRating(body?.rating);

  if (!rating) {
    return badRequest("A whole-number rating between 1 and 5 is required.");
  }

  try {
    await setRatingForBook(user.id, bookId, rating);
    return noContent();
  } catch (error) {
    console.error("Error saving rating:", error);
    return serverError("Unable to save rating.");
  }
}
