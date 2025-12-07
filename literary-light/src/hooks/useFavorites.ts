import { useState, useEffect } from "react";

const FAVORITES_STORAGE_KEY = "literary-light-favorites";
const FAVORITES_CHANGE_EVENT = "favorites-changed";

export interface Favorite {
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
}

function getStoredFavorites(): Favorite[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading favorites:", error);
    return [];
  }
}

function saveFavorites(favorites: Favorite[]) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    // Dispatch custom event to notify all components
    window.dispatchEvent(new CustomEvent(FAVORITES_CHANGE_EVENT));
  } catch (error) {
    console.error("Error saving favorites:", error);
  }
}

export function useFavorites(userId?: string) {
  const [allFavorites, setAllFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    // Load initial favorites
    setAllFavorites(getStoredFavorites());

    // Listen for favorites changes
    const handleFavoritesChange = () => {
      setAllFavorites(getStoredFavorites());
    };

    window.addEventListener(FAVORITES_CHANGE_EVENT, handleFavoritesChange);

    return () => {
      window.removeEventListener(FAVORITES_CHANGE_EVENT, handleFavoritesChange);
    };
  }, []);

  const userFavorites = userId
    ? allFavorites.filter((f) => f.userId === userId)
    : [];

  const favoriteBookIds = new Set(userFavorites.map((f) => f.bookId));

  const isFavorite = (bookId: string): boolean => {
    if (!userId) return false;
    return favoriteBookIds.has(bookId);
  };

  const toggleFavorite = (bookId: string): boolean => {
    if (!userId) return false;

    const existingFavorite = allFavorites.find(
      (f) => f.userId === userId && f.bookId === bookId
    );

    let updated: Favorite[];

    if (existingFavorite) {
      // Remove from favorites
      updated = allFavorites.filter((f) => f.id !== existingFavorite.id);
      setAllFavorites(updated);
      saveFavorites(updated);
      return false;
    } else {
      // Add to favorites
      const newFavorite: Favorite = {
        id: `fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        bookId,
        createdAt: new Date().toISOString(),
      };
      updated = [...allFavorites, newFavorite];
      setAllFavorites(updated);
      saveFavorites(updated);
      return true;
    }
  };

  const getFavoriteBookIds = (): string[] => {
    return Array.from(favoriteBookIds);
  };

  return {
    favorites: userFavorites,
    isFavorite,
    toggleFavorite,
    getFavoriteBookIds,
  };
}
