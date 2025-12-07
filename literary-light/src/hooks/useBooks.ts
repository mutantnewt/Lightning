import { useState, useEffect } from "react";
import { Book } from "@/types";
import { seedBooks } from "@/data/books";

const STORAGE_KEY = "literary-light-user-books";

export function useBooks() {
  const [userBooks, setUserBooks] = useState<Book[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>(seedBooks);
  const [isLoading, setIsLoading] = useState(true);

  // Load user books from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Book[];
        setUserBooks(parsed);
        setAllBooks([...seedBooks, ...parsed]);
      }
    } catch (error) {
      console.error("Error loading user books:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addBook = (bookDetails: Partial<Book>): Book => {
    // Generate a unique ID
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newBook: Book = {
      id,
      title: bookDetails.title || "Untitled",
      author: bookDetails.author || "Unknown",
      year: bookDetails.year || null,
      era: bookDetails.era || null,
      country: bookDetails.country || null,
      category: bookDetails.category || null,
      workType: bookDetails.workType || "Other",
      summary: bookDetails.summary || "",
      authorBio: bookDetails.authorBio || "",
      tags: bookDetails.tags || [],
      source: bookDetails.source || null,
      publicDomain: bookDetails.publicDomain ?? true,
      publicDomainNotes: bookDetails.publicDomainNotes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedUserBooks = [...userBooks, newBook];
    setUserBooks(updatedUserBooks);
    setAllBooks([...seedBooks, ...updatedUserBooks]);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserBooks));
    } catch (error) {
      console.error("Error saving user books:", error);
    }

    return newBook;
  };

  const removeBook = (bookId: string) => {
    // Only allow removing user-added books, not seed books
    if (!bookId.startsWith("user-")) {
      console.warn("Cannot remove seed books");
      return false;
    }

    const updatedUserBooks = userBooks.filter((book) => book.id !== bookId);
    setUserBooks(updatedUserBooks);
    setAllBooks([...seedBooks, ...updatedUserBooks]);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserBooks));
    } catch (error) {
      console.error("Error saving user books:", error);
    }

    return true;
  };

  return {
    books: allBooks,
    seedBooks,
    userBooks,
    addBook,
    removeBook,
    isLoading,
  };
}
