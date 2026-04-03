import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { BookCard } from "@/components/BookCard";
import { useAuthorBooks } from "@/hooks/useAuthorBooks";
import { User, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Author = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  const authorName = decodeURIComponent(name || "");
  const { books: authorBooks, isLoading } = useAuthorBooks(authorName);

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Loading author page...
            </h2>
          </div>
        </div>
      </Layout>
    );
  }

  if (authorBooks.length === 0) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <User className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Author not found
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              We couldn't find any books by {authorName} in our collection.
            </p>
            <Button onClick={() => navigate("/")} className="btn-accent mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Get author bio from first book
  const authorBio = authorBooks[0]?.authorBio || "";

  return (
    <Layout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <header className="mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <User className="h-10 w-10 text-accent" />
          </div>
          <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl text-center">
            {authorName}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground text-center">
            {authorBooks.length} book{authorBooks.length !== 1 ? "s" : ""} in our collection
          </p>
        </header>

        {authorBio && (
          <div className="mb-10">
            <div className="rounded-lg border border-border bg-secondary/50 p-6">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-accent" />
                <h2 className="font-serif text-xl font-semibold text-foreground">
                  About the Author
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {authorBio}
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Works by {authorName.split(" ").slice(-1)[0]}
            </h2>
          </div>
        </div>

        <div className="space-y-4">
          {authorBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Author;
