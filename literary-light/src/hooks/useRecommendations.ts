import { useMemo } from "react";
import { Book } from "@/types";

interface RecommendationScore {
  book: Book;
  score: number;
  reasons: string[];
}

export function useRecommendations(
  allBooks: Book[],
  favoriteBookIds: string[],
  limit: number = 5
): Book[] {
  return useMemo(() => {
    if (favoriteBookIds.length === 0) {
      return [];
    }

    const favoriteBooks = allBooks.filter((book) =>
      favoriteBookIds.includes(book.id)
    );

    if (favoriteBooks.length === 0) {
      return [];
    }

    // Collect attributes from favorite books
    const favoriteTags = new Set<string>();
    const favoriteEras = new Set<string>();
    const favoriteCountries = new Set<string>();
    const favoriteCategories = new Set<string>();
    const favoriteWorkTypes = new Set<string>();
    const favoriteAuthors = new Set<string>();

    favoriteBooks.forEach((book) => {
      book.tags.forEach((tag) => favoriteTags.add(tag));
      if (book.era) favoriteEras.add(book.era);
      if (book.country) favoriteCountries.add(book.country);
      if (book.category) favoriteCategories.add(book.category);
      favoriteWorkTypes.add(book.workType);
      favoriteAuthors.add(book.author);
    });

    // Score each non-favorite book
    const scoredBooks: RecommendationScore[] = allBooks
      .filter((book) => !favoriteBookIds.includes(book.id))
      .map((book) => {
        let score = 0;
        const reasons: string[] = [];

        // Tag similarity (high weight)
        const matchingTags = book.tags.filter((tag) => favoriteTags.has(tag));
        if (matchingTags.length > 0) {
          score += matchingTags.length * 3;
          reasons.push(`Shares ${matchingTags.length} tag(s) with your favorites`);
        }

        // Era match (medium weight)
        if (book.era && favoriteEras.has(book.era)) {
          score += 2;
          reasons.push(`From the ${book.era} era you enjoy`);
        }

        // Country match (medium weight)
        if (book.country && favoriteCountries.has(book.country)) {
          score += 2;
          reasons.push(`From ${book.country} like your favorites`);
        }

        // Category match (medium weight)
        if (book.category && favoriteCategories.has(book.category)) {
          score += 2;
          reasons.push(`In the ${book.category} category`);
        }

        // Work type match (low weight)
        if (favoriteWorkTypes.has(book.workType)) {
          score += 1;
          reasons.push(`Same work type: ${book.workType}`);
        }

        // Same author as favorites (high weight)
        if (favoriteAuthors.has(book.author)) {
          score += 4;
          reasons.push(`By ${book.author}, an author you love`);
        }

        return { book, score, reasons };
      })
      .filter((item) => item.score > 0) // Only include books with some relevance
      .sort((a, b) => b.score - a.score); // Sort by score descending

    return scoredBooks.slice(0, limit).map((item) => item.book);
  }, [allBooks, favoriteBookIds, limit]);
}

export function getRecommendationReasons(
  book: Book,
  favoriteBooks: Book[]
): string[] {
  const reasons: string[] = [];

  if (favoriteBooks.length === 0) {
    return reasons;
  }

  const favoriteTags = new Set<string>();
  const favoriteEras = new Set<string>();
  const favoriteCountries = new Set<string>();
  const favoriteCategories = new Set<string>();
  const favoriteAuthors = new Set<string>();

  favoriteBooks.forEach((favBook) => {
    favBook.tags.forEach((tag) => favoriteTags.add(tag));
    if (favBook.era) favoriteEras.add(favBook.era);
    if (favBook.country) favoriteCountries.add(favBook.country);
    if (favBook.category) favoriteCategories.add(favBook.category);
    favoriteAuthors.add(favBook.author);
  });

  const matchingTags = book.tags.filter((tag) => favoriteTags.has(tag));
  if (matchingTags.length > 0) {
    reasons.push(`Shares ${matchingTags.length} tag(s) with your favorites`);
  }

  if (book.era && favoriteEras.has(book.era)) {
    reasons.push(`From the ${book.era} era`);
  }

  if (book.country && favoriteCountries.has(book.country)) {
    reasons.push(`From ${book.country}`);
  }

  if (book.category && favoriteCategories.has(book.category)) {
    reasons.push(`In the ${book.category} category`);
  }

  if (favoriteAuthors.has(book.author)) {
    reasons.push(`By ${book.author}, an author you love`);
  }

  return reasons;
}
