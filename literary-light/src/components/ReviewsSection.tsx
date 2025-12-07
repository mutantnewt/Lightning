import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useReviews } from "@/hooks/useRatings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { Trash2 } from "lucide-react";

interface ReviewsSectionProps {
  bookId: string;
}

export function ReviewsSection({ bookId }: ReviewsSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const { reviews, addReview, deleteReview } = useReviews(bookId);
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(5);

  const handleSubmit = () => {
    if (!user || !newReview.trim()) return;

    addReview(user.id, user.name, bookId, newRating, newReview);
    setNewReview("");
    setNewRating(5);
  };

  const handleDelete = (reviewId: string) => {
    if (!user) return;
    deleteReview(reviewId, user.id);
  };

  return (
    <div className="space-y-4">
      {isAuthenticated && (
        <div className="space-y-3 p-4 rounded-md bg-background border border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Your rating:</span>
            <StarRating rating={newRating} onRate={setNewRating} />
          </div>
          <Textarea
            value={newReview}
            onChange={(e) => setNewReview(e.target.value)}
            placeholder="Write your review..."
            className="min-h-[100px]"
          />
          <Button
            onClick={handleSubmit}
            disabled={!newReview.trim()}
            size="sm"
          >
            Post Review
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No reviews yet. Be the first to review this book!
          </p>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="p-4 rounded-md bg-background border border-border"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{review.userName}</span>
                    <StarRating rating={review.rating} readonly size="sm" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm leading-relaxed">{review.review}</p>
                </div>
                {user && user.id === review.userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(review.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
