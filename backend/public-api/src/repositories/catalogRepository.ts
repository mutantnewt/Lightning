import type { Book, FaqEntry } from "../../../../contracts/domain";
import { seedCatalogBooks, seedFaqEntries } from "../../../../contracts/catalog-seed";

function sortBooks(books: Book[]): Book[] {
  return [...books].sort((left, right) => left.title.localeCompare(right.title));
}

export class CatalogRepository {
  async listBooks(): Promise<Book[]> {
    return sortBooks(seedCatalogBooks);
  }

  async listFaqEntries(): Promise<FaqEntry[]> {
    return [...seedFaqEntries]
      .filter((entry) => entry.isActive)
      .sort((left, right) => left.order - right.order);
  }

  async listBooksByAuthor(authorName: string): Promise<Book[]> {
    return sortBooks(
      seedCatalogBooks.filter((book) => book.author === authorName),
    );
  }
}
