import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { Book } from "@/types";
import { createBookSuggestionsClient } from "@/api/book-suggestions";
import type { BookSearchResult } from "@contracts/book-suggestions";
import {
  Search,
  RotateCcw,
  Loader2,
  CheckCircle,
  XCircle,
  PlusCircle,
  RefreshCw,
  X,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "search" | "results" | "details";
const bookSuggestionsClient = createBookSuggestionsClient();

const AddBook = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { books } = useBooks();
  const { isAuthenticated } = useAuth();

  // Form inputs
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [author, setAuthor] = useState(searchParams.get("author") || "");
  const [keyword, setKeyword] = useState("");

  // Step management
  const [step, setStep] = useState<Step>("search");

  // Results
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [bookDetails, setBookDetails] = useState<Partial<Book> | null>(null);
  const [detailsAuditEntryId, setDetailsAuditEntryId] = useState<string | null>(null);
  const [detailsSource, setDetailsSource] = useState<"openai" | "offline" | null>(null);

  // Loading states
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleReset = () => {
    setTitle("");
    setAuthor("");
    setKeyword("");
    setStep("search");
    setSearchResults([]);
    setSelectedBook(null);
    setBookDetails(null);
    setDetailsAuditEntryId(null);
    setDetailsSource(null);
  };

  const handleSearch = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Sign in to suggest books for Lightning Classics.",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim() && !author.trim() && !keyword.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter at least a title, author, or keyword.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);

    try {
      const results = await searchBooks(
        {
          title: title.trim() || undefined,
          author: author.trim() || undefined,
          keyword: keyword.trim() || undefined,
          existingBooks: books.map((book) => ({
            title: book.title,
            author: book.author,
            year: book.year ?? null,
          })),
        }
      );

      if (results.results.length === 0) {
        toast({
          title: "No results found",
          description: "No public domain books found matching your search that aren't already in the library.",
          variant: "destructive",
        });
        setIsSearching(false);
        return;
      }

      setSearchResults(results.results);
      setStep("results");
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "An error occurred while searching.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectBook = async (book: BookSearchResult) => {
    setSelectedBook(book);
    setIsLoadingDetails(true);
    setStep("details");

    try {
      const details = await getBookDetails(book.title, book.author);
      setBookDetails(details.book);
      setDetailsAuditEntryId(details.auditEntryId);
      setDetailsSource(details.source);
    } catch (error) {
      toast({
        title: "Failed to load details",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
      setStep("results");
      setSelectedBook(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleAddBook = () => {
    if (!bookDetails) return;

    void (async () => {
      try {
        await bookSuggestionsClient.submitBookSuggestion(
          bookDetails,
          detailsAuditEntryId,
          detailsSource ?? "offline",
        );

        toast({
          title: "Suggestion submitted",
          description: `"${bookDetails.title ?? "This book"}" has been submitted for review.`,
        });

        setTimeout(() => {
          navigate("/");
        }, 1000);
      } catch (error) {
        toast({
          title: "Unable to add book",
          description:
            error instanceof Error
              ? error.message
              : "An error occurred while saving this book.",
          variant: "destructive",
        });
      }
    })();
  };

  const handleRefine = () => {
    setStep("results");
    setSelectedBook(null);
    setBookDetails(null);
    setDetailsAuditEntryId(null);
    setDetailsSource(null);
  };

  const handleBackToSearch = () => {
    setStep("search");
    setSearchResults([]);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Add a Book
          </h1>
          <p className="mt-3 text-muted-foreground">
            {step === "search" && "Enter a title and/or author. We'll search for matching public domain books."}
            {step === "results" && "Select a book to view details and submit it for review."}
            {step === "details" && "Review the book details before submitting it for review."}
          </p>
        </header>

        {!isAuthenticated && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Sign in to search for books and submit suggestions. Add Book now records a
                moderated submission instead of publishing directly to the shared catalog.
              </p>
            </div>
          </div>
        )}

        {/* STEP 1: SEARCH */}
        {step === "search" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="rounded-lg border border-border bg-card p-6 shadow-book"
            data-testid="add-book-search-form"
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-sm font-medium">
                  Title
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Great Expectations"
                  className="input-classic mt-1.5"
                  disabled={isSearching}
                  data-testid="add-book-title-input"
                />
              </div>

              <div>
                <Label htmlFor="author" className="text-sm font-medium">
                  Author
                </Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g., Charles Dickens"
                  className="input-classic mt-1.5"
                  disabled={isSearching}
                  data-testid="add-book-author-input"
                />
              </div>

              <div>
                <Label htmlFor="keyword" className="text-sm font-medium">
                  Keyword / Subject
                </Label>
                <Input
                  id="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g., adventure, romance, philosophy"
                  className="input-classic mt-1.5"
                  disabled={isSearching}
                  data-testid="add-book-keyword-input"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                At least one field is required
              </p>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={
                    !isAuthenticated ||
                    isSearching ||
                    (!title.trim() && !author.trim() && !keyword.trim())
                  }
                  className="btn-primary flex-1"
                  data-testid="add-book-search-submit"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search for books
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSearching}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>

            {isSearching && (
              <div className="mt-6 rounded-md bg-secondary/50 p-4 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Searching for public domain books...
                </p>
              </div>
            )}
          </form>
        )}

        {/* STEP 2: RESULTS */}
        {step === "results" && (
          <div className="space-y-4 animate-fade-in" data-testid="add-book-results-step">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handleBackToSearch}
                className="text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to search
              </Button>
              <p className="text-sm text-muted-foreground">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
              </p>
            </div>

            <div className="space-y-3">
              {searchResults.map((book, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
                  data-testid="add-book-search-result"
                  data-book-title={book.title}
                  data-book-author={book.author}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-serif text-lg font-semibold text-foreground">
                        {book.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        by {book.author}
                      </p>
                      {book.year && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Published: {book.year}
                        </p>
                      )}
                      <p className="text-sm text-foreground/80 mt-2">
                        {book.brief}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSelectBook(book)}
                      className="btn-accent flex-shrink-0"
                      size="sm"
                      data-testid="add-book-select-result"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS */}
        {step === "details" && (
          <div className="space-y-6 animate-fade-in" data-testid="add-book-details-step">
            {isLoadingDetails ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-book">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Loading book details...
                </p>
              </div>
            ) : bookDetails ? (
              <>
                <div className="rounded-lg border border-border bg-card p-6 shadow-book">
                  <div data-testid="add-book-details-card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-serif text-2xl font-bold text-foreground">
                        {bookDetails.title}
                      </h2>
                      <p className="text-muted-foreground">by {bookDetails.author}</p>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-medium",
                        bookDetails.publicDomain ? "text-accent" : "text-destructive"
                      )}
                    >
                      {bookDetails.publicDomain ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Public Domain
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          Copyrighted
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    {bookDetails.year && (
                      <div>
                        <span className="text-muted-foreground">Year:</span>{" "}
                        <span className="font-medium">{bookDetails.year}</span>
                      </div>
                    )}
                    {bookDetails.era && (
                      <div>
                        <span className="text-muted-foreground">Era:</span>{" "}
                        <span className="font-medium">{bookDetails.era}</span>
                      </div>
                    )}
                    {bookDetails.country && (
                      <div>
                        <span className="text-muted-foreground">Country:</span>{" "}
                        <span className="font-medium">{bookDetails.country}</span>
                      </div>
                    )}
                    {bookDetails.category && (
                      <div>
                        <span className="text-muted-foreground">Category:</span>{" "}
                        <span className="font-medium">{bookDetails.category}</span>
                      </div>
                    )}
                    {bookDetails.workType && (
                      <div>
                        <span className="text-muted-foreground">Type:</span>{" "}
                        <span className="font-medium">{bookDetails.workType}</span>
                      </div>
                    )}
                  </div>

                  {bookDetails.tags && bookDetails.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {bookDetails.tags.map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {bookDetails.publicDomainNotes && (
                    <div className="rounded-md bg-secondary/50 p-3 text-sm mb-4">
                      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Copyright Status
                      </p>
                      <p className="text-foreground/90">{bookDetails.publicDomainNotes}</p>
                    </div>
                  )}

                  {bookDetails.summary && (
                    <div className="rounded-md bg-secondary/50 p-3 text-sm mb-4">
                      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Summary
                      </p>
                      <p className="text-foreground/90 leading-relaxed">
                        {bookDetails.summary}
                      </p>
                    </div>
                  )}

                  {bookDetails.authorBio && (
                    <div className="rounded-md bg-secondary/50 p-3 text-sm">
                      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        About the Author
                      </p>
                      <p className="text-foreground/90 leading-relaxed">
                        {bookDetails.authorBio}
                      </p>
                    </div>
                  )}
                  </div>
                </div>

                {bookDetails.publicDomain ? (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleAddBook}
                      className="btn-accent flex-1"
                      data-testid="add-book-confirm"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Submit for review
                    </Button>
                    <Button variant="outline" onClick={handleRefine}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refine
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-foreground">
                          This book is still under copyright
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Lightning Classics only includes public domain works. This
                          book cannot be added to our library at this time.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <Button variant="outline" onClick={handleRefine}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refine search
                      </Button>
                      <Button variant="outline" onClick={handleReset}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AddBook;

async function searchBooks(input: Parameters<typeof bookSuggestionsClient.searchBooks>[0]) {
  return bookSuggestionsClient.searchBooks(input);
}

async function getBookDetails(title: string, author: string) {
  return bookSuggestionsClient.getBookDetails(title, author);
}
