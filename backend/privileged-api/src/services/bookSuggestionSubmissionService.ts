import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../../../contracts/auth";
import type {
  BookSuggestionModerationStatus,
  BookSuggestionSubmission,
  SubmitBookSuggestionRequest,
} from "../../../../contracts/book-suggestions";
import { getBookSuggestionSubmissionStore } from "../repositories/bookSuggestionSubmissionStore";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function sanitizeBookForSubmission(
  book: SubmitBookSuggestionRequest["book"],
): SubmitBookSuggestionRequest["book"] {
  const title = normalizeOptionalString(book.title);
  const author = normalizeOptionalString(book.author);
  const summary = normalizeOptionalString(book.summary);
  const authorBio = normalizeOptionalString(book.authorBio);
  const era = normalizeOptionalString(book.era);
  const country = normalizeOptionalString(book.country);
  const category = normalizeOptionalString(book.category);
  const source = normalizeOptionalString(book.source);
  const publicDomainNotes = normalizeOptionalString(book.publicDomainNotes);

  return {
    ...book,
    ...(title ? { title } : {}),
    ...(author ? { author } : {}),
    ...(summary ? { summary } : {}),
    ...(authorBio ? { authorBio } : {}),
    ...(era ? { era } : {}),
    ...(country ? { country } : {}),
    ...(category ? { category } : {}),
    ...(source ? { source } : {}),
    ...(publicDomainNotes ? { publicDomainNotes } : {}),
    ...(Array.isArray(book.tags)
      ? {
          tags: book.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }
      : {}),
  };
}

export async function createBookSuggestionSubmission(input: {
  user: AuthUser;
  source: "openai" | "offline";
  book: SubmitBookSuggestionRequest["book"];
  sourceAuditEntryId?: string | null;
}): Promise<BookSuggestionSubmission> {
  const title = normalizeOptionalString(input.book.title);
  const author = normalizeOptionalString(input.book.author);

  if (!title || !author) {
    throw new Error("Book suggestions require a title and author.");
  }

  const createdAt = new Date().toISOString();
  const submission: BookSuggestionSubmission = {
    id: `book-suggestion-submission:${randomUUID()}`,
    status: "pending_review",
    source: input.source,
    createdAt,
    updatedAt: createdAt,
    sourceAuditEntryId: input.sourceAuditEntryId ?? null,
    book: sanitizeBookForSubmission({
      ...input.book,
      title,
      author,
    }),
    requestedBy: {
      id: input.user.id,
      username: input.user.username,
      email: input.user.email,
      name: input.user.name,
    },
    moderationNotes: null,
    lastModeratedAt: null,
    lastModeratedByUserId: null,
    decisionAuditEntryId: null,
    acceptedAt: null,
    acceptedByUserId: null,
    acceptedBookId: null,
    acceptedAuditEntryId: null,
  };

  return getBookSuggestionSubmissionStore().createSubmission(submission);
}

export async function getBookSuggestionSubmissionById(
  submissionId: string,
): Promise<BookSuggestionSubmission | null> {
  return getBookSuggestionSubmissionStore().getSubmissionById(submissionId);
}

export async function listPendingBookSuggestionSubmissions(): Promise<
  BookSuggestionSubmission[]
> {
  return getBookSuggestionSubmissionStore().listSubmissionsByStatus("pending_review");
}

export async function listBookSuggestionSubmissionsByStatus(
  status: BookSuggestionModerationStatus,
): Promise<BookSuggestionSubmission[]> {
  return getBookSuggestionSubmissionStore().listSubmissionsByStatus(status);
}

export async function markBookSuggestionSubmissionAccepted(input: {
  submissionId: string;
  acceptedAt: string;
  acceptedByUserId: string;
  acceptedBookId: string;
  acceptedAuditEntryId: string;
  moderationNotes: string | null;
}): Promise<BookSuggestionSubmission | null> {
  return getBookSuggestionSubmissionStore().markSubmissionAccepted(input);
}

export async function markBookSuggestionSubmissionModerated(input: {
  submissionId: string;
  status: Extract<BookSuggestionModerationStatus, "deferred" | "rejected">;
  moderatedAt: string;
  moderatedByUserId: string;
  moderationNotes: string;
  decisionAuditEntryId: string;
}): Promise<BookSuggestionSubmission | null> {
  return getBookSuggestionSubmissionStore().markSubmissionModerated(input);
}
