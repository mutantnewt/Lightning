import { useEffect, useState } from "react";
import type { Book } from "@/types";
import { createCatalogClient } from "@/api/catalog";
import { allowLocalRuntimeFallbacks } from "@/config/runtime";
import { seedBooks } from "@/data/books";

const catalogClient = createCatalogClient();

export function useAuthorBooks(authorName?: string) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!authorName) {
      setBooks([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const loadAuthorBooks = async () => {
      try {
        const nextBooks = await catalogClient.listBooksByAuthor(authorName);
        if (isMounted) {
          setBooks(nextBooks);
          setError(null);
        }
      } catch (error) {
        console.error("Error loading author books:", error);
        if (isMounted) {
          if (allowLocalRuntimeFallbacks()) {
            setBooks(seedBooks.filter((book) => book.author === authorName));
            setError(null);
          } else {
            setBooks([]);
            setError(
              error instanceof Error
                ? error.message
                : "Unable to load this author right now.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAuthorBooks();

    return () => {
      isMounted = false;
    };
  }, [authorName]);

  return {
    books,
    isLoading,
    error,
  };
}
