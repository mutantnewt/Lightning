import type { UpsertReadingListRequest } from "../../../../contracts/user-state";
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
  listReadingListsForUser,
  removeReadingListForUser,
  upsertReadingListForUser,
} from "../services/userStateService";

function isReadingListType(value: unknown): value is UpsertReadingListRequest["listType"] {
  return (
    value === "wantToRead" ||
    value === "currentlyReading" ||
    value === "finished"
  );
}

function normalizeProgress(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(100, value));
}

export async function listReadingListsHandler(
  event: HttpEvent
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    const readingLists = await listReadingListsForUser(user.id);
    return ok({ readingLists });
  } catch (error) {
    console.error("Error listing reading lists:", error);
    return serverError("Unable to load reading lists.");
  }
}

export async function upsertReadingListHandler(
  event: HttpEvent,
  bookId: string
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  const body = parseJsonBody<UpsertReadingListRequest>(event);

  if (!body) {
    return badRequest("A JSON request body is required.");
  }

  if (body.bookId !== bookId) {
    return badRequest("Path book ID does not match request body book ID.");
  }

  if (!isReadingListType(body.listType)) {
    return badRequest("A valid reading-list type is required.");
  }

  try {
    const progress = normalizeProgress(body.progress);
    const request = {
      bookId,
      listType: body.listType,
      finishedAt:
        typeof body.finishedAt === "string" && body.finishedAt
          ? body.finishedAt
          : null,
      ...(typeof progress === "number" ? { progress } : {}),
    };

    await upsertReadingListForUser(user.id, request);
    return noContent();
  } catch (error) {
    console.error("Error upserting reading list:", error);
    return serverError("Unable to save reading-list item.");
  }
}

export async function deleteReadingListHandler(
  event: HttpEvent,
  bookId: string
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  try {
    await removeReadingListForUser(user.id, bookId);
    return noContent();
  } catch (error) {
    console.error("Error removing reading-list item:", error);
    return serverError("Unable to remove reading-list item.");
  }
}
