import type { Book, FaqEntry } from "@contracts/domain";
import { faqEntries } from "@/data/faq";
import { seedBooks } from "@/data/books";
import type { CatalogClient } from "./client";

function sortBooks(books: Book[]): Book[] {
  return [...books].sort((left, right) => left.title.localeCompare(right.title));
}

export class LocalCatalogClient implements CatalogClient {
  readonly mode = "local" as const;

  async listBooks(): Promise<Book[]> {
    return sortBooks(seedBooks);
  }

  async listFaqEntries(): Promise<FaqEntry[]> {
    return [...faqEntries]
      .filter((entry) => entry.isActive)
      .sort((left, right) => left.order - right.order);
  }

  async listBooksByAuthor(authorName: string): Promise<Book[]> {
    return sortBooks(seedBooks.filter((book) => book.author === authorName));
  }

  async createBook(): Promise<Book> {
    throw new Error("Catalog writes require a configured backend.");
  }
}
