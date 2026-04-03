import { getAuthenticatedUser } from "../../../shared/auth";
import {
  noContent,
  ok,
  serverError,
  unauthorized,
  type HttpEvent,
  type HttpResponse,
} from "../../../shared/http";
import {
  addFavoriteForUser,
  listFavoritesForUser,
  removeFavoriteForUser,
} from "../services/userStateService";

export async function listFavoritesHandler(
  event: HttpEvent
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    const favorites = await listFavoritesForUser(user.id);
    return ok({ favorites });
  } catch (error) {
    console.error("Error listing favorites:", error);
    return serverError("Unable to load favorites.");
  }
}

export async function putFavoriteHandler(
  event: HttpEvent,
  _bookId: string
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    await addFavoriteForUser(user.id, _bookId);
    return noContent();
  } catch (error) {
    console.error("Error adding favorite:", error);
    return serverError("Unable to save favorite.");
  }
}

export async function deleteFavoriteHandler(
  event: HttpEvent,
  _bookId: string
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    await removeFavoriteForUser(user.id, _bookId);
    return noContent();
  } catch (error) {
    console.error("Error removing favorite:", error);
    return serverError("Unable to remove favorite.");
  }
}
