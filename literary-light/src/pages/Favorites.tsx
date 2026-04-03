import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { BookCard } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useFavorites } from "@/hooks/useFavorites";
import { Heart, RefreshCw, ArrowUpDown } from "lucide-react";
import { Book } from "@/types";

type SortField = "title" | "author" | "year";
type SortOrder = "asc" | "desc";

const Favorites = () => {
  const { user, isAuthenticated } = useAuth();
  const { books } = useBooks();
  const { favorites, getFavoriteBookIds } = useFavorites(user?.id);

  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [hiddenBookIds, setHiddenBookIds] = useState<Set<string>>(new Set());

  // Get favorite books (excluding hidden ones after deselecting)
  const favoriteBooks = useMemo(() => {
    const favoriteBookIds = new Set(favorites.map((f) => f.bookId));
    return books.filter(
      (book) => favoriteBookIds.has(book.id) && !hiddenBookIds.has(book.id)
    );
  }, [books, favorites, hiddenBookIds]);

  // Sort favorite books
  const sortedBooks = useMemo(() => {
    const sorted = [...favoriteBooks];

    sorted.sort((a, b) => {
      let compareA: string | number;
      let compareB: string | number;

      switch (sortField) {
        case "title":
          compareA = a.title.toLowerCase();
          compareB = b.title.toLowerCase();
          break;
        case "author":
          compareA = a.author.toLowerCase();
          compareB = b.author.toLowerCase();
          break;
        case "year":
          compareA = a.year || 0;
          compareB = b.year || 0;
          break;
      }

      if (compareA < compareB) return sortOrder === "asc" ? -1 : 1;
      if (compareA > compareB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [favoriteBooks, sortField, sortOrder]);

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending order
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleRefresh = () => {
    // Remove books that have been deselected from favorites
    const currentFavoriteIds = new Set(getFavoriteBookIds());
    const newHiddenIds = new Set<string>();

    sortedBooks.forEach((book) => {
      if (!currentFavoriteIds.has(book.id)) {
        newHiddenIds.add(book.id);
      }
    });

    setHiddenBookIds(newHiddenIds);
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Sign in to view favorites
            </h2>
            <p className="mt-3 text-muted-foreground">
              Create an account to save your favorite books and build your personal collection.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
                My Favorites
              </h1>
              <p className="mt-2 text-muted-foreground">
                {sortedBooks.length === 0
                  ? "You haven't added any favorites yet"
                  : `${sortedBooks.length} favorite book${sortedBooks.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            {sortedBooks.length > 0 && (
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            )}
          </div>
        </header>

        {sortedBooks.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-muted-foreground flex items-center">
              Sort by:
            </span>
            <Button
              variant={sortField === "title" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSortChange("title")}
              className="flex items-center gap-1.5"
            >
              Title
              {sortField === "title" && (
                <ArrowUpDown className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant={sortField === "author" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSortChange("author")}
              className="flex items-center gap-1.5"
            >
              Author
              {sortField === "author" && (
                <ArrowUpDown className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant={sortField === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSortChange("year")}
              className="flex items-center gap-1.5"
            >
              Year
              {sortField === "year" && (
                <ArrowUpDown className="h-3 w-3" />
              )}
            </Button>
            {sortField && (
              <span className="text-xs text-muted-foreground flex items-center ml-2">
                ({sortOrder === "asc" ? "ascending" : "descending"})
              </span>
            )}
          </div>
        )}

        {sortedBooks.length > 0 ? (
          <div className="space-y-4">
            {sortedBooks.map((book) => (
              <BookCard key={book.id} book={book} showFavoriteHeart />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground">
              No favorite books yet
            </h2>
            <p className="mt-2 text-muted-foreground">
              Start exploring and click the heart icon on books you love to add them here.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Favorites;
