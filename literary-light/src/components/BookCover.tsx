import { useState } from "react";
import { Book } from "@/types";
import { useBookCover } from "@/hooks/useBookCover";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookCoverProps {
  book: Book;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function BookCover({ book, size = "md", className }: BookCoverProps) {
  const { cover, loading, error } = useBookCover(book.id, book.title, book.author);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "w-16 h-24",
    md: "w-32 h-48",
    lg: "w-48 h-72",
  };

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  if (loading) {
    return (
      <Skeleton className={cn(sizeClasses[size], "flex-shrink-0", className)} />
    );
  }

  if (error || imageError || !cover) {
    return (
      <div
        className={cn(
          sizeClasses[size],
          "flex-shrink-0 bg-navy/10 border border-border rounded-md flex flex-col items-center justify-center p-3",
          className
        )}
      >
        <BookOpen className={cn(iconSizes[size], "text-navy/40 mb-2")} />
        <p className="text-xs text-center text-navy/60 font-serif leading-tight">
          {book.title.length > 20 ? book.title.substring(0, 20) + "..." : book.title}
        </p>
        <p className="text-xs text-center text-navy/40 mt-1">
          {book.author.length > 15 ? book.author.substring(0, 15) + "..." : book.author}
        </p>
      </div>
    );
  }

  return (
    <img
      src={cover.medium}
      alt={`Cover of ${book.title} by ${book.author}`}
      className={cn(
        sizeClasses[size],
        "flex-shrink-0 object-cover rounded-md shadow-md border border-border",
        className
      )}
      onError={() => setImageError(true)}
      loading="lazy"
    />
  );
}
