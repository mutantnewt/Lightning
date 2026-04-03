import type { Book, FaqEntry } from "../../contracts/domain";

export const BOOKS_PARTITION_KEY = "CATALOG#BOOKS";
export const FAQ_PARTITION_KEY = "CATALOG#FAQ";

export function normalizeCatalogText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function getCatalogTitleAuthorKey(
  book: Pick<Book, "title" | "author">,
): string {
  return `${normalizeCatalogText(book.title)}::${normalizeCatalogText(book.author)}`;
}

export function buildCatalogBookSortKey(
  book: Pick<Book, "title" | "author">,
): string {
  return `BOOK#${normalizeCatalogText(book.title)}#${normalizeCatalogText(book.author)}`;
}

export function buildCatalogFaqSortKey(entry: FaqEntry): string {
  return `FAQ#${String(entry.order).padStart(6, "0")}#${entry.id}`;
}
