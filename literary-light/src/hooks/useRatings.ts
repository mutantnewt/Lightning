import { useState, useEffect } from "react";

const RATINGS_STORAGE_KEY = "literary-light-ratings";
const REVIEWS_STORAGE_KEY = "literary-light-reviews";
const RATINGS_CHANGE_EVENT = "ratings-changed";
const REVIEWS_CHANGE_EVENT = "reviews-changed";

export interface Rating {
  id: string;
  userId: string;
  bookId: string;
  rating: number;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  bookId: string;
  rating: number;
  review: string;
  createdAt: string;
  helpful: number;
}

function getStoredRatings(): Rating[] {
  try {
    const stored = localStorage.getItem(RATINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading ratings:", error);
    return [];
  }
}

function getStoredReviews(): Review[] {
  try {
    const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading reviews:", error);
    return [];
  }
}

function saveRatings(ratings: Rating[]) {
  try {
    localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratings));
    window.dispatchEvent(new CustomEvent(RATINGS_CHANGE_EVENT));
  } catch (error) {
    console.error("Error saving ratings:", error);
  }
}

function saveReviews(reviews: Review[]) {
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
    window.dispatchEvent(new CustomEvent(REVIEWS_CHANGE_EVENT));
  } catch (error) {
    console.error("Error saving reviews:", error);
  }
}

export function useRatings(bookId?: string) {
  const [allRatings, setAllRatings] = useState<Rating[]>([]);

  useEffect(() => {
    setAllRatings(getStoredRatings());

    const handleChange = () => {
      setAllRatings(getStoredRatings());
    };

    window.addEventListener(RATINGS_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(RATINGS_CHANGE_EVENT, handleChange);
  }, []);

  const bookRatings = bookId
    ? allRatings.filter((r) => r.bookId === bookId)
    : allRatings;

  const averageRating = bookRatings.length
    ? bookRatings.reduce((sum, r) => sum + r.rating, 0) / bookRatings.length
    : 0;

  const getUserRating = (userId: string, targetBookId: string): number => {
    const rating = allRatings.find(
      (r) => r.userId === userId && r.bookId === targetBookId
    );
    return rating ? rating.rating : 0;
  };

  const setRating = (userId: string, targetBookId: string, rating: number): boolean => {
    if (!userId || rating < 1 || rating > 5) return false;

    const existing = allRatings.find(
      (r) => r.userId === userId && r.bookId === targetBookId
    );

    let updated: Rating[];
    if (existing) {
      updated = allRatings.map((r) =>
        r.id === existing.id ? { ...r, rating } : r
      );
    } else {
      const newRating: Rating = {
        id: `rating-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        bookId: targetBookId,
        rating,
        createdAt: new Date().toISOString(),
      };
      updated = [...allRatings, newRating];
    }

    setAllRatings(updated);
    saveRatings(updated);
    return true;
  };

  return {
    ratings: bookRatings,
    averageRating,
    ratingCount: bookRatings.length,
    getUserRating,
    setRating,
  };
}

export function useReviews(bookId?: string) {
  const [allReviews, setAllReviews] = useState<Review[]>([]);

  useEffect(() => {
    setAllReviews(getStoredReviews());

    const handleChange = () => {
      setAllReviews(getStoredReviews());
    };

    window.addEventListener(REVIEWS_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(REVIEWS_CHANGE_EVENT, handleChange);
  }, []);

  const bookReviews = bookId
    ? allReviews.filter((r) => r.bookId === bookId).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : allReviews;

  const addReview = (
    userId: string,
    userName: string,
    targetBookId: string,
    rating: number,
    review: string
  ): boolean => {
    if (!userId || !review.trim()) return false;

    const newReview: Review = {
      id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName,
      bookId: targetBookId,
      rating,
      review: review.trim(),
      createdAt: new Date().toISOString(),
      helpful: 0,
    };

    const updated = [...allReviews, newReview];
    setAllReviews(updated);
    saveReviews(updated);
    return true;
  };

  const deleteReview = (reviewId: string, userId: string): boolean => {
    const review = allReviews.find((r) => r.id === reviewId);
    if (!review || review.userId !== userId) return false;

    const updated = allReviews.filter((r) => r.id !== reviewId);
    setAllReviews(updated);
    saveReviews(updated);
    return true;
  };

  return {
    reviews: bookReviews,
    addReview,
    deleteReview,
  };
}
