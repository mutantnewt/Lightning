import { useEffect, useState } from "react";
import type { FavoriteRecord } from "@contracts/domain";
import { createUserStateClient } from "@/api/user-state";

const userStateClient = createUserStateClient();

export type Favorite = FavoriteRecord;

export function useFavorites(userId?: string) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      setFavorites([]);
      return;
    }

    const loadFavorites = async () => {
      try {
        const nextFavorites = await userStateClient.listFavorites(userId);
        if (isMounted) {
          setFavorites(nextFavorites);
          setError(null);
        }
      } catch (error) {
        console.error("Error loading favorites:", error);
        if (isMounted) {
          setFavorites([]);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load favorites right now.",
          );
        }
      }
    };

    void loadFavorites();

    const unsubscribe = userStateClient.subscribe(() => {
      void loadFavorites();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  const favoriteBookIds = new Set(favorites.map((favorite) => favorite.bookId));

  const isFavorite = (bookId: string): boolean => {
    if (!userId) {
      return false;
    }

    return favoriteBookIds.has(bookId);
  };

  const toggleFavorite = async (bookId: string): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    const shouldAddFavorite = !favoriteBookIds.has(bookId);

    if (shouldAddFavorite) {
      await userStateClient.addFavorite(userId, bookId);
    } else {
      await userStateClient.removeFavorite(userId, bookId);
    }

    const nextFavorites = await userStateClient.listFavorites(userId);
    setFavorites(nextFavorites);

    return shouldAddFavorite;
  };

  const getFavoriteBookIds = (): string[] => {
    return Array.from(favoriteBookIds);
  };

  return {
    favorites,
    error,
    isFavorite,
    toggleFavorite,
    getFavoriteBookIds,
  };
}
