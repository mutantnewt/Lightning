import type { Book, FaqEntry } from "./domain";

export interface BooksResponse {
  books: Book[];
}

export interface FaqEntriesResponse {
  faqEntries: FaqEntry[];
}

export interface CreateCatalogBookRequest {
  book: Partial<Book>;
  sourceAuditEntryId?: string | null;
}

export interface CreateCatalogBookResponse {
  book: Book;
}
