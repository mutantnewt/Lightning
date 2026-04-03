import { ok, serverError, type HttpResponse } from "../../../shared/http";
import { listAuthorBooks } from "../services/catalogService";

export async function getAuthorBooksHandler(authorName: string): Promise<HttpResponse> {
  try {
    const books = await listAuthorBooks(authorName);
    return ok({ books });
  } catch (error) {
    console.error("Error loading author books:", error);
    return serverError("Unable to load author books.");
  }
}
