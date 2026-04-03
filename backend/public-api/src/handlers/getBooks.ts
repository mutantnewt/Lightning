import { ok, serverError, type HttpResponse } from "../../../shared/http";
import { listCatalogBooks } from "../services/catalogService";

export async function getBooksHandler(): Promise<HttpResponse> {
  try {
    const books = await listCatalogBooks();
    return ok({ books });
  } catch (error) {
    console.error("Error loading books:", error);
    return serverError("Unable to load books.");
  }
}
