import type { Book, FaqEntry } from "../../contracts/domain";

export interface CatalogStore {
  listBooks(): Promise<Book[]>;
  listFaqEntries(): Promise<FaqEntry[]>;
  listBooksByAuthor(authorName: string): Promise<Book[]>;
  createBook(book: Book): Promise<Book>;
}

export class CatalogBookExistsError extends Error {
  constructor(message = "That book already exists in the catalog.") {
    super(message);
    this.name = "CatalogBookExistsError";
  }
}
