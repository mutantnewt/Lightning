import type { BookSuggestionAuditEntry } from "../../../../contracts/book-suggestions";
import { getBookSuggestionAuditStore } from "../repositories/bookSuggestionAuditStore";
import { randomUUID } from "node:crypto";

export async function appendBookSuggestionAuditEntry(
  entry: Omit<BookSuggestionAuditEntry, "id" | "createdAt">,
): Promise<BookSuggestionAuditEntry> {
  return getBookSuggestionAuditStore().appendEntry({
    id: `book-suggestion-audit:${randomUUID()}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
}
