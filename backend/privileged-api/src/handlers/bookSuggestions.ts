import type {
  AcceptBookSuggestionRequest,
  BookSuggestionModerationStatus,
  GetBookSuggestionDetailsRequest,
  ListBookSuggestionSubmissionsResponse,
  ModerateBookSuggestionRequest,
  ModerateBookSuggestionResponse,
  SearchBookSuggestionsRequest,
  SubmitBookSuggestionRequest,
} from "../../../../contracts/book-suggestions";
import {
  badRequest,
  conflict,
  notFound,
  ok,
  parseJsonBody,
  serverError,
  type HttpEvent,
  type HttpResponse,
} from "../../../shared/http";
import { createCatalogBook } from "../../../shared/catalogService";
import { CatalogBookExistsError } from "../../../shared/catalogTypes";
import { appendBookSuggestionAuditEntry } from "../services/bookSuggestionAuditService";
import {
  createBookSuggestionSubmission,
  getBookSuggestionSubmissionById,
  listBookSuggestionSubmissionsByStatus,
  listPendingBookSuggestionSubmissions,
  markBookSuggestionSubmissionAccepted,
  markBookSuggestionSubmissionModerated,
} from "../services/bookSuggestionSubmissionService";
import {
  getBookSuggestionDetails,
  searchBookSuggestions,
} from "../services/bookSuggestionProvider";
import {
  requireAuthenticatedPrivilegedContext,
  requireCatalogModeratorContext,
} from "../services/privilegedAccess";

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function getRequestedModerationStatus(
  event: HttpEvent,
): BookSuggestionModerationStatus | null {
  const rawStatus = normalizeOptionalString(event.queryStringParameters?.status);

  if (!rawStatus) {
    return "pending_review";
  }

  if (
    rawStatus === "pending_review" ||
    rawStatus === "accepted" ||
    rawStatus === "deferred" ||
    rawStatus === "rejected"
  ) {
    return rawStatus;
  }

  return null;
}

export async function searchBookSuggestionsHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  const authResult = await requireAuthenticatedPrivilegedContext(event);

  if (!authResult.context) {
    return authResult.response;
  }

  const body = parseJsonBody<SearchBookSuggestionsRequest>(event);

  if (!body) {
    return badRequest("A JSON request body is required.");
  }

  const title = normalizeOptionalString(body.title);
  const author = normalizeOptionalString(body.author);
  const keyword = normalizeOptionalString(body.keyword);
  const input = {
    ...(title ? { title } : {}),
    ...(author ? { author } : {}),
    ...(keyword ? { keyword } : {}),
    existingBooks: Array.isArray(body.existingBooks) ? body.existingBooks : [],
  };

  if (!title && !author && !keyword) {
    return badRequest("At least title, author, or keyword must be provided.");
  }

  try {
    const response = await searchBookSuggestions(input);
    const auditEntry = await appendBookSuggestionAuditEntry({
      stage: "search",
      source: response.source,
      input: input,
      output: {
        resultCount: response.results.length,
        results: response.results,
      },
    });

    return ok({
      results: response.results,
      source: response.source,
      auditEntryId: auditEntry.id,
    });
  } catch (error) {
    console.error("Error searching book suggestions:", error);
    return serverError("Unable to search for book suggestions.");
  }
}

export async function listBookSuggestionSubmissionsHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  const authResult = await requireCatalogModeratorContext(event);

  if (!authResult.context) {
    return authResult.response;
  }

  try {
    const status = getRequestedModerationStatus(event);

    if (!status) {
      return badRequest("Unsupported moderation status.");
    }

    const submissions = status === "pending_review"
      ? await listPendingBookSuggestionSubmissions()
      : await listBookSuggestionSubmissionsByStatus(status);
    const response: ListBookSuggestionSubmissionsResponse = {
      submissions,
    };

    return ok(response);
  } catch (error) {
    console.error("Error listing book suggestion submissions:", error);
    return serverError("Unable to load pending book suggestions.");
  }
}

export async function getBookSuggestionDetailsHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  const authResult = await requireAuthenticatedPrivilegedContext(event);

  if (!authResult.context) {
    return authResult.response;
  }

  const body = parseJsonBody<GetBookSuggestionDetailsRequest>(event);
  const title = normalizeOptionalString(body?.title);
  const author = normalizeOptionalString(body?.author);

  if (!title || !author) {
    return badRequest("Title and author are required.");
  }

  try {
    const response = await getBookSuggestionDetails(title, author);
    const auditEntry = await appendBookSuggestionAuditEntry({
      stage: "details",
      source: response.source,
      input: { title, author },
      output: {
        book: response.book,
      },
    });

    return ok({
      book: response.book,
      source: response.source,
      auditEntryId: auditEntry.id,
    });
  } catch (error) {
    console.error("Error loading book suggestion details:", error);
    return serverError("Unable to load book details.");
  }
}

export async function submitBookSuggestionHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  const authResult = await requireAuthenticatedPrivilegedContext(event);

  if (!authResult.context) {
    return authResult.response;
  }

  const body = parseJsonBody<SubmitBookSuggestionRequest>(event);

  if (!body || typeof body.book !== "object" || body.book === null) {
    return badRequest("A book payload is required.");
  }

  const title = normalizeOptionalString(body.book.title);
  const author = normalizeOptionalString(body.book.author);

  if (!title || !author) {
    return badRequest("Book suggestions must include title and author.");
  }

  try {
    const submission = await createBookSuggestionSubmission({
      user: authResult.context.user,
      source: body.source ?? "offline",
      book: body.book,
      sourceAuditEntryId: body.sourceAuditEntryId ?? null,
    });
    const auditEntry = await appendBookSuggestionAuditEntry({
      stage: "submit",
      source: submission.source,
      input: {
        requestedByUserId: authResult.context.user.id,
        requestedByEmail: authResult.context.user.email,
        sourceAuditEntryId: body.sourceAuditEntryId ?? null,
      },
      output: {
        submissionId: submission.id,
        moderationStatus: submission.status,
        requestedBook: submission.book,
      },
    });

    return ok({
      submitted: true,
      moderationStatus: "pending_review",
      submissionId: submission.id,
      auditEntryId: auditEntry.id,
    });
  } catch (error) {
    console.error("Error submitting book suggestion:", error);
    return serverError("Unable to submit this book for review.");
  }
}

async function moderateBookSuggestionSubmissionHandler(
  event: HttpEvent,
  status: Extract<BookSuggestionModerationStatus, "deferred" | "rejected">,
): Promise<HttpResponse> {
  const authResult = await requireCatalogModeratorContext(event);

  if (!authResult.context) {
    return authResult.response;
  }

  const body = parseJsonBody<ModerateBookSuggestionRequest>(event);
  const submissionId = normalizeOptionalString(body?.submissionId);
  const moderationNotes = normalizeOptionalString(body?.moderationNotes);

  if (!submissionId) {
    return badRequest("A submissionId is required.");
  }

  if (!moderationNotes) {
    return badRequest("Moderator notes are required for this action.");
  }

  try {
    const submission = await getBookSuggestionSubmissionById(submissionId);

    if (!submission) {
      return notFound("That book suggestion submission could not be found.");
    }

    if (submission.status !== "pending_review") {
      return conflict("Only pending submissions can be moderated.");
    }

    const auditEntry = await appendBookSuggestionAuditEntry({
      stage: status === "deferred" ? "defer" : "reject",
      source: submission.source,
      input: {
        moderatedByUserId: authResult.context.user.id,
        submissionId,
        moderationNotes,
      },
      output: {
        moderationStatus: status,
        requestedBook: submission.book,
      },
    });

    await markBookSuggestionSubmissionModerated({
      submissionId,
      status,
      moderatedAt: new Date().toISOString(),
      moderatedByUserId: authResult.context.user.id,
      moderationNotes,
      decisionAuditEntryId: auditEntry.id,
    });

    const response: ModerateBookSuggestionResponse = {
      moderated: true,
      moderationStatus: status,
      submissionId,
      auditEntryId: auditEntry.id,
    };

    return ok(response);
  } catch (error) {
    console.error(`Error marking book suggestion as ${status}:`, error);
    return serverError("Unable to update this book suggestion.");
  }
}

export async function deferBookSuggestionHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  return moderateBookSuggestionSubmissionHandler(event, "deferred");
}

export async function rejectBookSuggestionHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  return moderateBookSuggestionSubmissionHandler(event, "rejected");
}

export async function acceptBookSuggestionHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  const authResult = await requireCatalogModeratorContext(event);

  if (!authResult.context) {
    return authResult.response;
  }

  const body = parseJsonBody<AcceptBookSuggestionRequest>(event);

  if (!body || typeof body.book !== "object" || body.book === null) {
    return badRequest("A book payload is required.");
  }

  const title = normalizeOptionalString(body.book.title);
  const author = normalizeOptionalString(body.book.author);
  const moderationNotes = normalizeOptionalString(body.moderationNotes) ?? null;

  if (!title || !author) {
    return badRequest("Accepted book suggestions must include title and author.");
  }

  try {
    if (body.submissionId) {
      const submission = await getBookSuggestionSubmissionById(body.submissionId);

      if (!submission) {
        return notFound("That book suggestion submission could not be found.");
      }

      if (submission.status !== "pending_review") {
        return conflict("Only pending submissions can be published.");
      }
    }

    const createdBook = await createCatalogBook(body.book);
    const auditEntry = await appendBookSuggestionAuditEntry({
      stage: "accept",
      source: "offline",
      input: {
        moderatedByUserId: authResult.context.user.id,
        sourceAuditEntryId: body.sourceAuditEntryId ?? null,
        submissionId: body.submissionId ?? null,
      },
      output: {
        acceptedBook: createdBook,
      },
    });

    if (body.submissionId) {
      await markBookSuggestionSubmissionAccepted({
        submissionId: body.submissionId,
        acceptedAt: new Date().toISOString(),
        acceptedByUserId: authResult.context.user.id,
        acceptedBookId: createdBook.id,
        acceptedAuditEntryId: auditEntry.id,
        moderationNotes,
      });
    }

    return ok({
      accepted: true,
      moderationStatus: "accepted",
      submissionId: body.submissionId ?? null,
      auditEntryId: auditEntry.id,
      book: createdBook,
    });
  } catch (error) {
    if (error instanceof CatalogBookExistsError) {
      return conflict(error.message);
    }

    console.error("Error accepting book suggestion:", error);
    return serverError("Unable to record accepted book suggestion.");
  }
}
