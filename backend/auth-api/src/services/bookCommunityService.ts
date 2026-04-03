import type { CommentRecord, ReviewRecord } from "../../../../contracts/domain";
import { getUserStateStore, type UserStateStore } from "../repositories/userStateStore";

let store: UserStateStore | null = null;

function getStore(): UserStateStore {
  if (!store) {
    store = getUserStateStore();
  }

  return store;
}

export async function listCommentsForBook(bookId: string): Promise<CommentRecord[]> {
  return getStore().listComments(bookId);
}

export async function addCommentForBook(
  userId: string,
  userName: string,
  bookId: string,
  text: string,
): Promise<CommentRecord> {
  return getStore().addComment(userId, userName, bookId, text);
}

export async function removeCommentForBook(
  userId: string,
  bookId: string,
  commentId: string,
): Promise<boolean> {
  return getStore().removeComment(userId, bookId, commentId);
}

export async function getRatingSummaryForBook(
  bookId: string,
): Promise<{ averageRating: number; ratingCount: number }> {
  return getStore().getRatingSummary(bookId);
}

export async function getUserRatingForBook(
  userId: string,
  bookId: string,
): Promise<number> {
  return getStore().getUserRating(userId, bookId);
}

export async function setRatingForBook(
  userId: string,
  bookId: string,
  rating: number,
): Promise<void> {
  return getStore().setRating(userId, bookId, rating);
}

export async function listReviewsForBook(bookId: string): Promise<ReviewRecord[]> {
  return getStore().listReviews(bookId);
}

export async function addReviewForBook(
  userId: string,
  userName: string,
  bookId: string,
  rating: number,
  review: string,
): Promise<ReviewRecord> {
  return getStore().addReview(userId, userName, bookId, rating, review);
}

export async function removeReviewForBook(
  userId: string,
  bookId: string,
  reviewId: string,
): Promise<boolean> {
  return getStore().removeReview(userId, bookId, reviewId);
}
