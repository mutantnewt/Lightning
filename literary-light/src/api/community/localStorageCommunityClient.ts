import type {
  CommentRecord,
  RatingRecord,
  ReviewRecord,
} from "@contracts/domain";
import type { CommunityClient, RatingSummary } from "./client";

const COMMENTS_STORAGE_KEY = "literary-light-comments";
const RATINGS_STORAGE_KEY = "literary-light-ratings";
const REVIEWS_STORAGE_KEY = "literary-light-reviews";

function getStoredItems<T>(storageKey: string): T[] {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as T[]) : [];
  } catch {
    return [];
  }
}

function setStoredItems<T>(storageKey: string, items: T[]): void {
  localStorage.setItem(storageKey, JSON.stringify(items));
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class LocalStorageCommunityClient implements CommunityClient {
  readonly mode = "local" as const;

  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  async listComments(bookId: string): Promise<CommentRecord[]> {
    return getStoredItems<CommentRecord>(COMMENTS_STORAGE_KEY)
      .filter((comment) => comment.bookId === bookId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async addComment(
    bookId: string,
    userId: string,
    userName: string,
    text: string,
  ): Promise<CommentRecord> {
    const comments = getStoredItems<CommentRecord>(COMMENTS_STORAGE_KEY);
    const createdComment: CommentRecord = {
      id: createId("comment"),
      bookId,
      userId,
      userName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setStoredItems(COMMENTS_STORAGE_KEY, [...comments, createdComment]);
    this.notify();
    return createdComment;
  }

  async deleteComment(
    bookId: string,
    commentId: string,
    userId: string,
  ): Promise<boolean> {
    const comments = getStoredItems<CommentRecord>(COMMENTS_STORAGE_KEY);
    const targetComment = comments.find(
      (comment) => comment.bookId === bookId && comment.id === commentId,
    );

    if (!targetComment || targetComment.userId !== userId) {
      return false;
    }

    setStoredItems(
      COMMENTS_STORAGE_KEY,
      comments.filter((comment) => comment.id !== commentId),
    );
    this.notify();
    return true;
  }

  async getRatingSummary(bookId: string): Promise<RatingSummary> {
    const ratings = getStoredItems<RatingRecord>(RATINGS_STORAGE_KEY).filter(
      (rating) => rating.bookId === bookId,
    );
    const ratingCount = ratings.length;
    const total = ratings.reduce((sum, rating) => sum + rating.rating, 0);

    return {
      averageRating: ratingCount > 0 ? total / ratingCount : 0,
      ratingCount,
    };
  }

  async getUserRating(bookId: string, userId: string): Promise<number> {
    const ratings = getStoredItems<RatingRecord>(RATINGS_STORAGE_KEY);
    const rating = ratings.find(
      (item) => item.bookId === bookId && item.userId === userId,
    );

    return rating?.rating ?? 0;
  }

  async setRating(bookId: string, userId: string, rating: number): Promise<void> {
    const ratings = getStoredItems<RatingRecord>(RATINGS_STORAGE_KEY);
    const existingRating = ratings.find(
      (item) => item.bookId === bookId && item.userId === userId,
    );
    const remainingRatings = ratings.filter(
      (item) => !(item.bookId === bookId && item.userId === userId),
    );

    setStoredItems(RATINGS_STORAGE_KEY, [
      ...remainingRatings,
      {
        id: existingRating?.id ?? createId("rating"),
        userId,
        bookId,
        rating,
        createdAt: existingRating?.createdAt ?? new Date().toISOString(),
      },
    ]);
    this.notify();
  }

  async listReviews(bookId: string): Promise<ReviewRecord[]> {
    return getStoredItems<ReviewRecord>(REVIEWS_STORAGE_KEY)
      .filter((review) => review.bookId === bookId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async addReview(
    bookId: string,
    userId: string,
    userName: string,
    rating: number,
    review: string,
  ): Promise<ReviewRecord> {
    const reviews = getStoredItems<ReviewRecord>(REVIEWS_STORAGE_KEY);
    const createdReview: ReviewRecord = {
      id: createId("review"),
      userId,
      userName,
      bookId,
      rating,
      review: review.trim(),
      createdAt: new Date().toISOString(),
      helpful: 0,
    };

    setStoredItems(REVIEWS_STORAGE_KEY, [...reviews, createdReview]);
    this.notify();
    return createdReview;
  }

  async deleteReview(
    bookId: string,
    reviewId: string,
    userId: string,
  ): Promise<boolean> {
    const reviews = getStoredItems<ReviewRecord>(REVIEWS_STORAGE_KEY);
    const targetReview = reviews.find(
      (review) => review.bookId === bookId && review.id === reviewId,
    );

    if (!targetReview || targetReview.userId !== userId) {
      return false;
    }

    setStoredItems(
      REVIEWS_STORAGE_KEY,
      reviews.filter((review) => review.id !== reviewId),
    );
    this.notify();
    return true;
  }
}
