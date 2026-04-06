import type { Book, FaqEntry } from "@contracts/domain";

export interface CatalogClient {
  readonly mode: "local" | "http" | "disabled";
  listBooks(): Promise<Book[]>;
  listFaqEntries(): Promise<FaqEntry[]>;
  listBooksByAuthor(authorName: string): Promise<Book[]>;
  createBook(
    book: Partial<Book>,
    sourceAuditEntryId?: string | null,
  ): Promise<Book>;
}
