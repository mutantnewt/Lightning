import type { CreateCatalogBookRequest } from "../../../../contracts/catalog";
import {
  badRequest,
  conflict,
  ok,
  parseJsonBody,
  serverError,
  type HttpEvent,
  type HttpResponse,
} from "../../../shared/http";
import { createCatalogBook } from "../../../shared/catalogService";
import { CatalogBookExistsError } from "../../../shared/catalogTypes";
import { requireCatalogModeratorContext } from "../services/privilegedAccess";

export async function createBookHandler(event: HttpEvent): Promise<HttpResponse> {
  const authResult = await requireCatalogModeratorContext(event);

  if (!authResult.context) {
    return authResult.response;
  }

  const body = parseJsonBody<CreateCatalogBookRequest>(event);

  if (!body || typeof body.book !== "object" || body.book === null) {
    return badRequest("A book payload is required.");
  }

  try {
    const book = await createCatalogBook(body.book);
    return ok({ book });
  } catch (error) {
    if (error instanceof CatalogBookExistsError) {
      return conflict(error.message);
    }

    console.error("Error creating catalog book:", error);
    return serverError("Unable to create catalog book.");
  }
}
