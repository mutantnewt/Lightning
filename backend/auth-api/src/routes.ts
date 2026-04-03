import { authApiRoutes } from "../../../contracts/api";

export const authRouteManifest = [
  {
    method: "GET",
    path: authApiRoutes.health,
    description: "Authenticated surface health check",
  },
  {
    method: "GET",
    path: authApiRoutes.me,
    description: "Current authenticated user profile",
  },
  {
    method: "GET",
    path: authApiRoutes.favorites,
    description: "List current user's favorite books",
  },
  {
    method: "PUT",
    path: `${authApiRoutes.favorites}/:bookId`,
    description: "Add a book to the current user's favorites",
  },
  {
    method: "DELETE",
    path: `${authApiRoutes.favorites}/:bookId`,
    description: "Remove a book from the current user's favorites",
  },
  {
    method: "GET",
    path: authApiRoutes.readingLists,
    description: "List current user's reading-list items",
  },
  {
    method: "PUT",
    path: `${authApiRoutes.readingLists}/:bookId`,
    description: "Upsert the current user's reading-list item for a book",
  },
  {
    method: "DELETE",
    path: `${authApiRoutes.readingLists}/:bookId`,
    description: "Delete the current user's reading-list item for a book",
  },
  {
    method: "POST",
    path: authApiRoutes.bookComments,
    description: "Create a comment for a book",
  },
  {
    method: "DELETE",
    path: `${authApiRoutes.bookComments}/:commentId`,
    description: "Delete the current user's comment for a book",
  },
  {
    method: "GET",
    path: authApiRoutes.bookUserRating,
    description: "Get the current user's rating for a book",
  },
  {
    method: "PUT",
    path: authApiRoutes.bookRatings,
    description: "Create or update the current user's rating for a book",
  },
  {
    method: "POST",
    path: authApiRoutes.bookReviews,
    description: "Create a review for a book",
  },
  {
    method: "DELETE",
    path: `${authApiRoutes.bookReviews}/:reviewId`,
    description: "Delete the current user's review for a book",
  },
] as const;
