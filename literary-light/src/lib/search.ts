import { Book } from "@/types";

export interface SearchFilters {
  era?: string | null;
  country?: string | null;
  category?: string | null;
  workType?: string | null;
}

export function searchBooks(books: Book[], query: string, filters?: SearchFilters): Book[] {
  let filteredBooks = books;

  // Apply filters first
  if (filters) {
    filteredBooks = filteredBooks.filter((book) => {
      if (filters.era && book.era !== filters.era) return false;
      if (filters.country && book.country !== filters.country) return false;
      if (filters.category && book.category !== filters.category) return false;
      if (filters.workType && book.workType !== filters.workType) return false;
      return true;
    });
  }

  // Then apply keyword search
  if (!query.trim()) {
    return filteredBooks;
  }

  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

  return filteredBooks.filter((book) => {
    const searchableText = [
      book.title,
      book.author,
      book.year?.toString() ?? "",
      book.era ?? "",
      book.country ?? "",
      book.category ?? "",
      book.workType,
      book.summary,
      book.authorBio,
      ...book.tags,
      book.source ?? "",
      book.publicDomain ? "public domain" : "",
    ]
      .join(" ")
      .toLowerCase();

    return keywords.every((keyword) => searchableText.includes(keyword));
  });
}

export function getUniqueValues(books: Book[], field: keyof Book): string[] {
  const values = new Set<string>();
  books.forEach((book) => {
    const value = book[field];
    if (value && typeof value === "string") {
      values.add(value);
    }
  });
  return Array.from(values).sort();
}

export function paginateResults<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function getTotalPages(totalItems: number, perPage: number): number {
  return Math.ceil(totalItems / perPage);
}
