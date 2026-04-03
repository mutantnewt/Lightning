import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  count?: number;
  testIdPrefix?: string;
}

export function StarRating({
  rating,
  onRate,
  readonly = false,
  size = "md",
  showCount = false,
  count = 0,
  testIdPrefix,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const stars = [1, 2, 3, 4, 5];

  return (
    <div
      className="flex items-center gap-1"
      data-testid={testIdPrefix ? `${testIdPrefix}-root` : undefined}
      data-rating-value={String(rating)}
      data-rating-count={String(count)}
    >
      {stars.map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onRate && onRate(star)}
          disabled={readonly}
          className={cn(
            "transition-colors",
            !readonly && "cursor-pointer hover:scale-110",
            readonly && "cursor-default"
          )}
          aria-label={`Rate ${star} stars`}
          type="button"
          data-testid={testIdPrefix ? `${testIdPrefix}-star-${star}` : undefined}
          data-filled={star <= Math.round(rating) ? "true" : "false"}
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= Math.round(rating)
                ? "fill-gold text-gold"
                : "fill-none text-muted-foreground"
            )}
          />
        </button>
      ))}
      {showCount && count > 0 && (
        <span className="ml-1 text-sm text-muted-foreground">
          ({count})
        </span>
      )}
    </div>
  );
}
