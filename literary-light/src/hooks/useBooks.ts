import { useEffect, useState } from "react";
import type { Book } from "@/types";
import { createCatalogClient } from "@/api/catalog";
import { allowLocalRuntimeFallbacks } from "@/config/runtime";
import { seedBooks } from "@/data/books";

const catalogClient = createCatalogClient();

function sortBooks(books: Book[]): Book[] {
  return [...books].sort((left, right) => left.title.localeCompare(right.title));
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>(
    allowLocalRuntimeFallbacks() ? seedBooks : [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBooks = async () => {
      try {
        const nextBooks = await catalogClient.listBooks();

        if (isMounted) {
          setBooks(sortBooks(nextBooks));
          setError(null);
        }
      } catch (error) {
        console.error("Error loading catalog books:", error);

        if (isMounted) {
          if (allowLocalRuntimeFallbacks()) {
            setBooks(sortBooks(seedBooks));
            setError(null);
          } else {
            setBooks([]);
            setError(
              error instanceof Error
                ? error.message
                : "Unable to load the catalog right now.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadBooks();

    return () => {
      isMounted = false;
    };
  }, []);

  const addBook = async (
    bookDetails: Partial<Book>,
    sourceAuditEntryId?: string | null,
  ): Promise<Book> => {
    const createdBook = await catalogClient.createBook(bookDetails, sourceAuditEntryId);
    setBooks((currentBooks) => sortBooks([...currentBooks, createdBook]));
    return createdBook;
  };

  const removeBook = () => false;

  return {
    books,
    seedBooks,
    userBooks: [] as Book[],
    addBook,
    removeBook,
    isLoading,
    error,
  };
}
