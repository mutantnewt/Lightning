import { useState } from "react";
import { Book } from "@/types";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, User, BookText, MessageSquare, Star, ShoppingCart, BookOpen, Headphones, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentsSection } from "@/components/CommentsSection";
import { ReviewsSection } from "@/components/ReviewsSection";
import { StarRating } from "@/components/StarRating";
import { ReadingListDropdown } from "@/components/ReadingListDropdown";
import { useComments } from "@/hooks/useComments";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { useRatings, useReviews } from "@/hooks/useRatings";
import { useToast } from "@/hooks/use-toast";
import { useCountry } from "@/hooks/useCountry";

interface BookCardProps {
  book: Book;
  showFavoriteHeart?: boolean;
  onSearch?: (query: string) => void;
}

export function BookCard({ book, showFavoriteHeart = false, onSearch }: BookCardProps) {
  const [showAuthorBio, setShowAuthorBio] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const { comments, error: commentsError, hasMore: hasMoreComments } = useComments(book.id);
  const commentCountLabel = hasMoreComments
    ? `${comments.length}+`
    : comments.length > 0
      ? String(comments.length)
      : null;

  const { user, isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite, error: favoritesError } = useFavorites(user?.id);
  const { toast } = useToast();
  const favorite = !favoritesError && isFavorite(book.id);

  const { averageRating, ratingCount, userRating, error: ratingsError, setRating } = useRatings(
    book.id,
    user?.id,
  );
  const { reviews, error: reviewsError, hasMore: hasMoreReviews } = useReviews(book.id);
  const reviewCountLabel = hasMoreReviews
    ? `${reviews.length}+`
    : reviews.length > 0
      ? String(reviews.length)
      : null;
  const { amazonDomain } = useCountry();

  // Affiliate links - replace YOUR_AFFILIATE_ID with your actual tags
  const searchQuery = encodeURIComponent(book.title + ' ' + book.author);
  const amazonUrl = `https://www.${amazonDomain}/s?k=${searchQuery}&tag=YOUR_AMAZON_AFFILIATE_ID`;
  const bookshopUrl = `https://bookshop.org/search?keywords=${searchQuery}&affiliate=YOUR_BOOKSHOP_AFFILIATE_ID`;
  const audibleUrl = `https://www.audible.com/search?keywords=${searchQuery}&tag=YOUR_AUDIBLE_AFFILIATE_ID`;

  const handleFavoriteToggle = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites",
        variant: "destructive",
      });
      return;
    }

    try {
      const newState = await toggleFavorite(book.id);
      toast({
        title: newState ? "Added to favorites" : "Removed from favorites",
        description: newState
          ? `"${book.title}" has been added to your favorites`
          : `"${book.title}" has been removed from your favorites`,
      });
    } catch (error) {
      toast({
        title: "Unable to update favorites",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong while saving your favorite.",
        variant: "destructive",
      });
    }
  };

  const handleRating = async (rating: number) => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to rate books",
        variant: "destructive",
      });
      return;
    }

    try {
      await setRating(rating);
      toast({
        title: "Rating saved",
        description: `You rated "${book.title}" ${rating} stars`,
      });
    } catch {
      toast({
        title: "Unable to save rating",
        description: "Something went wrong while saving your rating.",
        variant: "destructive",
      });
    }
  };

  return (
    <article
      className="book-card animate-fade-in"
      data-book-id={book.id}
      data-book-title={book.title}
    >
      <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1">
            <div className="flex items-start gap-2">
              <h3 className="font-serif text-xl font-semibold text-foreground leading-tight flex-1">
                {book.title}
              </h3>
              {isAuthenticated && (
                <button
                  onClick={handleFavoriteToggle}
                  className={cn(
                    "text-2xl transition-transform flex-shrink-0",
                    favoritesError
                      ? "cursor-not-allowed opacity-50"
                      : "hover:scale-110 cursor-pointer",
                  )}
                  title={
                    favoritesError
                      ? favoritesError
                      : favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                  }
                  disabled={Boolean(favoritesError)}
                >
                  {favorite || showFavoriteHeart ? "❤️" : "🤍"}
                </button>
              )}
            </div>
            <p className="mt-1 text-base text-muted-foreground">
              by{" "}
              <button
                onClick={() => onSearch?.(book.author)}
                className="font-medium text-accent hover:text-accent/80 transition-colors cursor-pointer hover:underline"
              >
                {book.author}
              </button>
              {book.year && (
                <span className="ml-1">({book.year < 0 ? `${Math.abs(book.year)} BCE` : book.year})</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {book.era && (
            <button
              onClick={() => onSearch?.(book.era!)}
              className="tag-chip hover:bg-accent/10 hover:border-accent transition-colors cursor-pointer"
            >
              {book.era}
            </button>
          )}
          {book.country && (
            <button
              onClick={() => onSearch?.(book.country!)}
              className="tag-chip hover:bg-accent/10 hover:border-accent transition-colors cursor-pointer"
            >
              {book.country}
            </button>
          )}
          {book.category && (
            <button
              onClick={() => onSearch?.(book.category!)}
              className="tag-chip hover:bg-accent/10 hover:border-accent transition-colors cursor-pointer"
            >
              {book.category}
            </button>
          )}
          <button
            onClick={() => onSearch?.(book.workType)}
            className="tag-chip hover:bg-accent/10 hover:border-accent transition-colors cursor-pointer"
          >
            {book.workType}
          </button>
          {book.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSearch?.(tag)}
              className="tag-chip hover:bg-accent/10 hover:border-accent transition-colors cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {ratingsError ? (
              <p className="text-sm text-muted-foreground">{ratingsError}</p>
            ) : (
              <StarRating
                rating={userRating || averageRating}
                onRate={(rating) => void handleRating(rating)}
                readonly={!isAuthenticated}
                showCount={true}
                count={ratingCount}
                testIdPrefix={`book-rating-${book.id}`}
              />
            )}
          </div>
          {isAuthenticated && (
            <ReadingListDropdown bookId={book.id} bookTitle={book.title} />
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {book.source && (
              <a
                href={book.source}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Read Free
                </Button>
              </a>
            )}

            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button
                variant="outline"
                size="sm"
                className="text-sm"
              >
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                Amazon
              </Button>
            </a>

            <a
              href={bookshopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button
                variant="outline"
                size="sm"
                className="text-sm"
              >
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                Bookshop
              </Button>
            </a>

            <a
              href={audibleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button
                variant="outline"
                size="sm"
                className="text-sm"
              >
                <Headphones className="mr-1.5 h-3.5 w-3.5" />
                Audible
              </Button>
            </a>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuthorBio(!showAuthorBio)}
              className="text-sm flex-shrink-0"
            >
              <User className="mr-1.5 h-3.5 w-3.5" />
              Author
              {showAuthorBio ? (
                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSummary(!showSummary)}
              className="text-sm flex-shrink-0"
            >
              <BookText className="mr-1.5 h-3.5 w-3.5" />
              Summary
              {showSummary ? (
                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="text-sm flex-shrink-0"
              data-testid={`book-comments-toggle-${book.id}`}
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Comments {!commentsError && commentCountLabel && `(${commentCountLabel})`}
              {showComments ? (
                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReviews(!showReviews)}
              className="text-sm flex-shrink-0"
              data-testid={`book-reviews-toggle-${book.id}`}
            >
              <Star className="mr-1.5 h-3.5 w-3.5" />
              Reviews {!reviewsError && reviewCountLabel && `(${reviewCountLabel})`}
              {showReviews ? (
                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSearch?.(book.category || book.tags[0] || book.era || book.workType)}
              className="text-sm flex-shrink-0"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Similar
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            showAuthorBio ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="rounded-md bg-secondary/50 p-4 text-sm leading-relaxed text-foreground/90">
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">
              About the Author
            </p>
            {book.authorBio}
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            showSummary ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="rounded-md bg-secondary/50 p-4 text-sm leading-relaxed text-foreground/90">
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Summary
            </p>
            {book.summary}
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            showComments ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="rounded-md bg-secondary/50 p-4">
            <CommentsSection bookId={book.id} />
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            showReviews ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="rounded-md bg-secondary/50 p-4">
            <ReviewsSection bookId={book.id} />
          </div>
        </div>
      </div>
    </article>
  );
}
