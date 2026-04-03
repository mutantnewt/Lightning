export const publicApiRoutes = {
  health: "/public/health",
  books: "/public/books",
  faq: "/public/faq",
  authorBooks: "/public/authors/:name/books",
  bookComments: "/public/books/:bookId/comments",
  bookRatings: "/public/books/:bookId/ratings",
  bookReviews: "/public/books/:bookId/reviews",
} as const;

export const authApiRoutes = {
  health: "/auth/health",
  me: "/auth/me",
  favorites: "/auth/favorites",
  readingLists: "/auth/reading-lists",
  bookComments: "/auth/books/:bookId/comments",
  bookRatings: "/auth/books/:bookId/ratings",
  bookUserRating: "/auth/books/:bookId/ratings/me",
  bookReviews: "/auth/books/:bookId/reviews",
  recommendations: "/auth/recommendations",
} as const;

export const privilegedApiRoutes = {
  bookSuggestions: "/privileged/book-suggestions",
  bookSuggestionsSubmissions: "/privileged/book-suggestions/submissions",
  bookSuggestionsSearch: "/privileged/book-suggestions/search",
  bookSuggestionsDetails: "/privileged/book-suggestions/details",
  bookSuggestionsSubmit: "/privileged/book-suggestions/submit",
  bookSuggestionsAccept: "/privileged/book-suggestions/accept",
  bookSuggestionsDefer: "/privileged/book-suggestions/defer",
  bookSuggestionsReject: "/privileged/book-suggestions/reject",
  catalogBooks: "/privileged/books",
} as const;

export type PublicApiRoute =
  (typeof publicApiRoutes)[keyof typeof publicApiRoutes];

export type AuthApiRoute =
  (typeof authApiRoutes)[keyof typeof authApiRoutes];

export type PrivilegedApiRoute =
  (typeof privilegedApiRoutes)[keyof typeof privilegedApiRoutes];

export function buildFavoriteRoute(bookId: string): string {
  return `${authApiRoutes.favorites}/${encodeURIComponent(bookId)}`;
}

export function buildReadingListRoute(bookId: string): string {
  return `${authApiRoutes.readingLists}/${encodeURIComponent(bookId)}`;
}

export function buildPublicBookCommentsRoute(bookId: string): string {
  return `/public/books/${encodeURIComponent(bookId)}/comments`;
}

export function buildPublicBookRatingsRoute(bookId: string): string {
  return `/public/books/${encodeURIComponent(bookId)}/ratings`;
}

export function buildPublicBookReviewsRoute(bookId: string): string {
  return `/public/books/${encodeURIComponent(bookId)}/reviews`;
}

export function buildAuthorBooksRoute(authorName: string): string {
  return `/public/authors/${encodeURIComponent(authorName)}/books`;
}

export function buildAuthBookCommentsRoute(bookId: string): string {
  return `/auth/books/${encodeURIComponent(bookId)}/comments`;
}

export function buildCommentRoute(bookId: string, commentId: string): string {
  return `${buildAuthBookCommentsRoute(bookId)}/${encodeURIComponent(commentId)}`;
}

export function buildAuthBookRatingsRoute(bookId: string): string {
  return `/auth/books/${encodeURIComponent(bookId)}/ratings`;
}

export function buildAuthBookUserRatingRoute(bookId: string): string {
  return `${buildAuthBookRatingsRoute(bookId)}/me`;
}

export function buildAuthBookReviewsRoute(bookId: string): string {
  return `/auth/books/${encodeURIComponent(bookId)}/reviews`;
}

export function buildReviewRoute(bookId: string, reviewId: string): string {
  return `${buildAuthBookReviewsRoute(bookId)}/${encodeURIComponent(reviewId)}`;
}

export function buildBookSuggestionSearchRoute(): string {
  return privilegedApiRoutes.bookSuggestionsSearch;
}

export function buildBookSuggestionSubmissionsRoute(status?: string): string {
  if (!status) {
    return privilegedApiRoutes.bookSuggestionsSubmissions;
  }

  return `${privilegedApiRoutes.bookSuggestionsSubmissions}?status=${encodeURIComponent(status)}`;
}

export function buildBookSuggestionDetailsRoute(): string {
  return privilegedApiRoutes.bookSuggestionsDetails;
}

export function buildBookSuggestionAcceptRoute(): string {
  return privilegedApiRoutes.bookSuggestionsAccept;
}

export function buildBookSuggestionDeferRoute(): string {
  return privilegedApiRoutes.bookSuggestionsDefer;
}

export function buildBookSuggestionRejectRoute(): string {
  return privilegedApiRoutes.bookSuggestionsReject;
}

export function buildBookSuggestionSubmitRoute(): string {
  return privilegedApiRoutes.bookSuggestionsSubmit;
}

export function buildCatalogBooksRoute(): string {
  return privilegedApiRoutes.catalogBooks;
}
