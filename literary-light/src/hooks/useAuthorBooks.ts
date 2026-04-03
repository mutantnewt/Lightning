import { useEffect, useState } from "react";
import type { Book } from "@/types";
import { createCatalogClient } from "@/api/catalog";
import { seedBooks } from "@/data/books";

const catalogClient = createCatalogClient();

export function useAuthorBooks(authorName?: string) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!authorName) {
      setBooks([]);
      setIsLoading(false);
      return;
    }

    const loadAuthorBooks = async () => {
      try {
        const nextBooks = await catalogClient.listBooksByAuthor(authorName);
        if (isMounted) {
          setBooks(nextBooks);
        }
      } catch (error) {
        console.error("Error loading author books:", error);
        if (isMounted) {
          setBooks(seedBooks.filter((book) => book.author === authorName));
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
  };
}
