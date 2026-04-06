import { useEffect, useState } from "react";
import type { RatingRecord, ReviewRecord } from "@contracts/domain";
import { communityPolicy } from "@contracts/user-state";
import { createCommunityClient } from "@/api/community";

const communityClient = createCommunityClient();

export type Rating = RatingRecord;
export type Review = ReviewRecord;

export function useRatings(bookId?: string, userId?: string) {
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!bookId) {
      setAverageRating(0);
      setRatingCount(0);
      setUserRating(0);
      setError(null);
      return;
    }

    const loadRatings = async () => {
      try {
        const [summary, nextUserRating] = await Promise.all([
          communityClient.getRatingSummary(bookId),
          userId ? communityClient.getUserRating(bookId, userId) : Promise.resolve(0),
        ]);

        if (isMounted) {
          setAverageRating(summary.averageRating);
          setRatingCount(summary.ratingCount);
          setUserRating(nextUserRating);
          setError(null);
        }
      } catch (error) {
        console.error("Error loading ratings:", error);
        if (isMounted) {
          setAverageRating(0);
          setRatingCount(0);
          setUserRating(0);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load ratings right now.",
          );
        }
      }
    };

    void loadRatings();

    const unsubscribe = communityClient.subscribe(() => {
      void loadRatings();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [bookId, userId]);

  const setRating = async (rating: number): Promise<void> => {
    if (!bookId || !userId) {
      throw new Error("Authentication required.");
    }

    try {
      await communityClient.setRating(bookId, userId, rating);
      const [summary, nextUserRating] = await Promise.all([
        communityClient.getRatingSummary(bookId),
        communityClient.getUserRating(bookId, userId),
      ]);
      setAverageRating(summary.averageRating);
      setRatingCount(summary.ratingCount);
      setUserRating(nextUserRating);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save your rating right now.",
      );
      throw error;
    }
  };

  return {
    averageRating,
    ratingCount,
    userRating,
    error,
    setRating,
  };
}

export function useReviews(bookId?: string) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!bookId) {
      setReviews([]);
      setError(null);
      setNextCursor(null);
      setHasMore(false);
      setIsLoadingMore(false);
      return;
    }

    const loadReviews = async () => {
      try {
        const response = await communityClient.listReviews(bookId, {
          limit: communityPolicy.defaultPageSize,
        });
        if (isMounted) {
          setReviews(response.items);
          setError(null);
          setNextCursor(response.nextCursor);
          setHasMore(response.hasMore);
          setIsLoadingMore(false);
        }
      } catch (error) {
        console.error("Error loading reviews:", error);
        if (isMounted) {
          setReviews([]);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load reviews right now.",
          );
          setNextCursor(null);
          setHasMore(false);
          setIsLoadingMore(false);
        }
      }
    };

    void loadReviews();

    const unsubscribe = communityClient.subscribe(() => {
      void loadReviews();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [bookId]);

  const addReview = async (
    userId: string,
    userName: string,
    rating: number,
    review: string,
  ): Promise<Review> => {
    if (!bookId) {
      throw new Error("Book ID is required to add a review.");
    }

    try {
      const createdReview = await communityClient.addReview(
        bookId,
        userId,
        userName,
        rating,
        review,
      );
      const response = await communityClient.listReviews(bookId, {
        limit: communityPolicy.defaultPageSize,
      });
      setReviews(response.items);
      setError(null);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      return createdReview;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to add your review right now.",
      );
      throw error;
    }
  };

  const deleteReview = async (
    reviewId: string,
    userId: string,
  ): Promise<boolean> => {
    if (!bookId) {
      return false;
    }

    try {
      const deleted = await communityClient.deleteReview(bookId, reviewId, userId);

      if (deleted) {
        const response = await communityClient.listReviews(bookId, {
          limit: communityPolicy.defaultPageSize,
        });
        setReviews(response.items);
        setError(null);
        setNextCursor(response.nextCursor);
        setHasMore(response.hasMore);
      }

      return deleted;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update reviews right now.",
      );
      throw error;
    }
  };

  const loadMore = async (): Promise<void> => {
    if (!bookId || !hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const response = await communityClient.listReviews(bookId, {
        cursor: nextCursor,
        limit: communityPolicy.defaultPageSize,
      });

      setReviews((currentReviews) => [...currentReviews, ...response.items]);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load more reviews right now.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    reviews,
    error,
    hasMore,
    isLoadingMore,
    addReview,
    deleteReview,
    loadMore,
  };
}
