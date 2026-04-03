import { useEffect, useState } from "react";
import type { RatingRecord, ReviewRecord } from "@contracts/domain";
import { createCommunityClient } from "@/api/community";

const communityClient = createCommunityClient();

export type Rating = RatingRecord;
export type Review = ReviewRecord;

export function useRatings(bookId?: string, userId?: string) {
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState(0);

  useEffect(() => {
    let isMounted = true;

    if (!bookId) {
      setAverageRating(0);
      setRatingCount(0);
      setUserRating(0);
      return;
    }

    const loadRatings = async () => {
      try {
        const [summary, nextUserRating] = await Promise.all([
          communityClient.getRatingSummary(bookId),
          userId
            ? communityClient.getUserRating(bookId, userId).catch(() => 0)
            : Promise.resolve(0),
        ]);

        if (isMounted) {
          setAverageRating(summary.averageRating);
          setRatingCount(summary.ratingCount);
          setUserRating(nextUserRating);
        }
      } catch (error) {
        console.error("Error loading ratings:", error);
        if (isMounted) {
          setAverageRating(0);
          setRatingCount(0);
          setUserRating(0);
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

    await communityClient.setRating(bookId, userId, rating);
    const [summary, nextUserRating] = await Promise.all([
      communityClient.getRatingSummary(bookId),
      communityClient.getUserRating(bookId, userId),
    ]);
    setAverageRating(summary.averageRating);
    setRatingCount(summary.ratingCount);
    setUserRating(nextUserRating);
  };

  return {
    averageRating,
    ratingCount,
    userRating,
    setRating,
  };
}

export function useReviews(bookId?: string) {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let isMounted = true;

    if (!bookId) {
      setReviews([]);
      return;
    }

    const loadReviews = async () => {
      try {
        const nextReviews = await communityClient.listReviews(bookId);
        if (isMounted) {
          setReviews(nextReviews);
        }
      } catch (error) {
        console.error("Error loading reviews:", error);
        if (isMounted) {
          setReviews([]);
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

    const createdReview = await communityClient.addReview(
      bookId,
      userId,
      userName,
      rating,
      review,
    );
    const nextReviews = await communityClient.listReviews(bookId);
    setReviews(nextReviews);
    return createdReview;
  };

  const deleteReview = async (
    reviewId: string,
    userId: string,
  ): Promise<boolean> => {
    if (!bookId) {
      return false;
    }

    const deleted = await communityClient.deleteReview(bookId, reviewId, userId);

    if (deleted) {
      const nextReviews = await communityClient.listReviews(bookId);
      setReviews(nextReviews);
    }

    return deleted;
  };

  return {
    reviews,
    addReview,
    deleteReview,
  };
}
