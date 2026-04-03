import { privilegedApiRoutes } from "../../../contracts/api";
import {
  badRequest,
  corsPreflight,
  getRequestMethod,
  getRequestPath,
  methodNotAllowed,
  notFound,
  type HttpEvent,
  type HttpResponse,
  withHttpEventContext,
} from "../../shared/http";
import {
  acceptBookSuggestionHandler,
  deferBookSuggestionHandler,
  getBookSuggestionDetailsHandler,
  listBookSuggestionSubmissionsHandler,
  rejectBookSuggestionHandler,
  searchBookSuggestionsHandler,
  submitBookSuggestionHandler,
} from "./handlers/bookSuggestions";
import { createBookHandler } from "./handlers/createBook";

function normalizePrivilegedPath(path: string): string {
  if (path.startsWith("/privileged/")) {
    return path;
  }

  return path;
}

export async function handler(event: HttpEvent): Promise<HttpResponse> {
  return withHttpEventContext(event, async () => {
    const method = getRequestMethod(event);
    const path = normalizePrivilegedPath(getRequestPath(event));

    if (method === "OPTIONS") {
      if (
        path === privilegedApiRoutes.bookSuggestionsSubmissions ||
        path === privilegedApiRoutes.bookSuggestionsSearch ||
        path === privilegedApiRoutes.bookSuggestionsDetails ||
        path === privilegedApiRoutes.bookSuggestionsSubmit ||
        path === privilegedApiRoutes.bookSuggestionsAccept ||
        path === privilegedApiRoutes.bookSuggestionsDefer ||
        path === privilegedApiRoutes.bookSuggestionsReject ||
        path === privilegedApiRoutes.catalogBooks
      ) {
        return corsPreflight(
          path === privilegedApiRoutes.bookSuggestionsSubmissions
            ? ["GET", "OPTIONS"]
            : ["POST", "OPTIONS"],
        );
      }
    }

    if (path === privilegedApiRoutes.bookSuggestionsSearch) {
      if (method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      return searchBookSuggestionsHandler(event);
    }

    if (path === privilegedApiRoutes.bookSuggestionsSubmissions) {
      if (method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      return listBookSuggestionSubmissionsHandler(event);
    }

    if (path === privilegedApiRoutes.bookSuggestionsDetails) {
      if (method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      return getBookSuggestionDetailsHandler(event);
    }

    if (path === privilegedApiRoutes.bookSuggestionsAccept) {
      if (method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      return acceptBookSuggestionHandler(event);
    }

    if (path === privilegedApiRoutes.bookSuggestionsDefer) {
      if (method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      return deferBookSuggestionHandler(event);
    }

    if (path === privilegedApiRoutes.bookSuggestionsReject) {
      if (method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      return rejectBookSuggestionHandler(event);
    }

    if (path === privilegedApiRoutes.bookSuggestionsSubmit) {
      if (method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      return submitBookSuggestionHandler(event);
    }

    if (path === privilegedApiRoutes.catalogBooks) {
      if (method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      return createBookHandler(event);
    }

    if (path.startsWith(`${privilegedApiRoutes.bookSuggestions}/`)) {
      return badRequest(`Malformed privileged route path: ${path}`);
    }

    return notFound(`No privileged route is registered for ${method} ${path}`);
  });
}
