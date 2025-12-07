import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  count?: number;
}

export function StarRating({
  rating,
  onRate,
  readonly = false,
  size = "md",
  showCount = false,
  count = 0,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
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
