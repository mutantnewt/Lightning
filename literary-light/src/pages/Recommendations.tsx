import { Layout } from "@/components/Layout";
import { BookCard } from "@/components/BookCard";
import { useBooks } from "@/hooks/useBooks";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { useRecommendations } from "@/hooks/useRecommendations";
import { Sparkles, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Recommendations = () => {
  const { books } = useBooks();
  const { user, isAuthenticated } = useAuth();
  const { favorites } = useFavorites(user?.id);
  const recommendedBooks = useRecommendations(books, favorites, 10);

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl">
          <header className="mb-10">
            <div className="inline-flex items-center justify-center gap-3 mb-4">
              <Sparkles className="h-10 w-10 text-accent" />
            </div>
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl text-center">
              Personalized Recommendations
            </h1>
          </header>

          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Heart className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Sign in to get personalized recommendations
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Our recommendation engine analyzes your favorite books to suggest titles you'll love. Sign in to start building your reading profile.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (favorites.length === 0) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl">
          <header className="mb-10">
            <div className="inline-flex items-center justify-center gap-3 mb-4">
              <Sparkles className="h-10 w-10 text-accent" />
            </div>
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl text-center">
              Personalized Recommendations
            </h1>
          </header>

          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Heart className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Add some favorites to get started
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Click the heart icon on books you enjoy, and we'll recommend similar titles based on your preferences.
            </p>
            <Link to="/favorites">
              <Button className="btn-accent mt-6">
                <Heart className="mr-2 h-4 w-4" />
                View Favorites
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-10 w-10 text-accent" />
          </div>
          <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl text-center">
            Recommended for You
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-center">
            Based on your {favorites.length} favorite book{favorites.length !== 1 ? "s" : ""}, here are some titles we think you'll enjoy.
          </p>
        </header>

        {recommendedBooks.length > 0 ? (
          <div className="space-y-4">
            {recommendedBooks.map((book) => (
              <BookCard key={book.id} book={book} showFavoriteHeart />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Sparkles className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              No recommendations yet
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              We couldn't find any books to recommend based on your current favorites. Try adding more favorites to get better recommendations!
            </p>
            <Link to="/">
              <Button className="btn-accent mt-6">
                Browse Books
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Recommendations;
