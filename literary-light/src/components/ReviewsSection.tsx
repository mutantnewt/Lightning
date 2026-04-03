import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useReviews } from "@/hooks/useRatings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface ReviewsSectionProps {
  bookId: string;
}

export function ReviewsSection({ bookId }: ReviewsSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const { reviews, addReview, deleteReview } = useReviews(bookId);
  const { toast } = useToast();
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !newReview.trim()) return;

    setIsSubmitting(true);

    try {
      await addReview(user.id, user.name, newRating, newReview);
      setNewReview("");
      setNewRating(5);
      toast({
        title: "Review posted",
        description: "Your review has been added successfully",
      });
    } catch {
      toast({
        title: "Unable to post review",
        description: "Something went wrong while saving your review.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!user) return;
    const deleted = await deleteReview(reviewId, user.id);

    if (deleted) {
      toast({
        title: "Review deleted",
        description: "Your review has been removed",
      });
      return;
    }

    toast({
      title: "Unable to delete review",
      description: "Only your own reviews can be deleted.",
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-4" data-testid={`reviews-section-${bookId}`}>
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
            disabled={isSubmitting}
            data-testid={`review-input-${bookId}`}
          />
          <Button
            onClick={() => void handleSubmit()}
            disabled={!newReview.trim() || isSubmitting}
            size="sm"
            data-testid={`post-review-${bookId}`}
          >
            {isSubmitting ? "Posting..." : "Post Review"}
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
              data-testid={`review-item-${bookId}`}
              data-review-id={review.id}
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
                    onClick={() => void handleDelete(review.id)}
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete review by ${review.userName}`}
                    data-testid={`delete-review-${bookId}`}
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
