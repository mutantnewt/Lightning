import { useState, useEffect } from "react";
import { getBookCover, CoverImage } from "@/services/covers";

const COVER_CACHE_KEY = "literary-light-cover-cache";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedCover {
  cover: CoverImage | null;
  timestamp: number;
}

function getCachedCover(bookId: string): CoverImage | null | undefined {
  try {
    const cache = localStorage.getItem(`${COVER_CACHE_KEY}-${bookId}`);
    if (!cache) return undefined;

    const cached: CachedCover = JSON.parse(cache);
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      localStorage.removeItem(`${COVER_CACHE_KEY}-${bookId}`);
      return undefined;
    }

    return cached.cover;
  } catch (error) {
    return undefined;
  }
}

function setCachedCover(bookId: string, cover: CoverImage | null) {
  try {
    const cached: CachedCover = {
      cover,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${COVER_CACHE_KEY}-${bookId}`, JSON.stringify(cached));
  } catch (error) {
    console.error("Error caching cover:", error);
  }
}

export function useBookCover(bookId: string, title: string, author: string) {
  const [cover, setCover] = useState<CoverImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cached = getCachedCover(bookId);

    if (cached !== undefined) {
      setCover(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    getBookCover(title, author)
      .then((fetchedCover) => {
        setCover(fetchedCover);
        setCachedCover(bookId, fetchedCover);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
        setCachedCover(bookId, null);
      });
  }, [bookId, title, author]);

  return { cover, loading, error };
}
