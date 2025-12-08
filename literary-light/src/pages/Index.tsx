import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SearchBar } from "@/components/SearchBar";
import { BookCard } from "@/components/BookCard";
import { BookCardSkeleton } from "@/components/BookCardSkeleton";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { useBooks } from "@/hooks/useBooks";
import { searchBooks, paginateResults, getTotalPages, getUniqueValues } from "@/lib/search";
import { SearchFilters, SearchFiltersState } from "@/components/SearchFilters";
import { PlusCircle, BookOpen } from "lucide-react";

const RESULTS_PER_PAGE = 10;

const Index = () => {
  const navigate = useNavigate();
  const { books, isLoading } = useBooks();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersState>({
    era: null,
    country: null,
    category: null,
    workType: null,
  });

  const filterOptions = useMemo(() => ({
    eras: getUniqueValues(books, "era"),
    countries: getUniqueValues(books, "country"),
    categories: getUniqueValues(books, "category"),
    workTypes: getUniqueValues(books, "workType"),
  }), [books]);

  const filteredBooks = useMemo(() => {
    return searchBooks(books, searchQuery, filters);
  }, [searchQuery, books, filters]);

  const totalPages = getTotalPages(filteredBooks.length, RESULTS_PER_PAGE);
  const paginatedBooks = paginateResults(filteredBooks, currentPage, RESULTS_PER_PAGE);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    setHasSearched(true);
  };

  const handleReset = () => {
    setSearchQuery("");
    setCurrentPage(1);
    setHasSearched(false);
    setFilters({ era: null, country: null, category: null, workType: null });
  };

  const handleFiltersChange = (newFilters: SearchFiltersState) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setHasSearched(true);
  };

  const handleRandom = () => {
    if (books.length === 0) return;
    const randomBook = books[Math.floor(Math.random() * books.length)];
    setSearchQuery(randomBook.title);
    setCurrentPage(1);
    setHasSearched(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddBook = () => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.set("title", searchQuery);
    }
    navigate(`/add-book${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl">
        {!hasSearched && (
          <div className="mb-12 text-center">
            <BookOpen className="h-20 w-20 text-accent mx-auto mb-6" />
            <h1 className="font-serif text-6xl font-bold text-foreground mb-2">
              Lightning Classics
            </h1>
          </div>
        )}
        <div className="mb-8">
          <div className="space-y-4">
            <SearchBar onSearch={handleSearch} onReset={handleReset} onRandom={handleRandom} initialQuery={searchQuery} totalBooks={books.length} />
            <SearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              eras={filterOptions.eras}
              countries={filterOptions.countries}
              categories={filterOptions.categories}
              workTypes={filterOptions.workTypes}
            />
          </div>
        </div>

        {hasSearched && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {filteredBooks.length === 0 ? (
                "No results found"
              ) : (
                <>
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {(currentPage - 1) * RESULTS_PER_PAGE + 1}–
                    {Math.min(currentPage * RESULTS_PER_PAGE, filteredBooks.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground">{filteredBooks.length}</span>{" "}
                  results
                  {searchQuery && (
                    <>
                      {" "}for "<span className="font-medium text-foreground">{searchQuery}</span>"
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        ) : hasSearched ? (
          paginatedBooks.length > 0 ? (
            <div className="space-y-4">
              {paginatedBooks.map((book) => (
                <BookCard key={book.id} book={book} onSearch={handleSearch} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <BookOpen className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                We couldn't find any books matching your search.
              </h2>
              <p className="mt-2 text-muted-foreground">
                Try different keywords, or explore and add new books to our library.
              </p>
              <Button onClick={handleAddBook} className="btn-accent mt-6">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Book
              </Button>
            </div>
          )
        ) : null}

        {hasSearched && paginatedBooks.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </Layout>
  );
};

export default Index;
