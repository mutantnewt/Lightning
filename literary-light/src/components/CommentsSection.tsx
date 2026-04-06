import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useComments";
import { communityPolicy } from "@contracts/user-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Trash2, User as UserIcon } from "lucide-react";

interface CommentsSectionProps {
  bookId: string;
}

export function CommentsSection({ bookId }: CommentsSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const { comments, error, addComment, deleteComment } = useComments(bookId);
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add comments",
        variant: "destructive",
      });
      return;
    }

    if (!newComment.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await addComment(user.id, user.name, newComment);
      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;

    try {
      const success = await deleteComment(commentId, user.id);

      if (success) {
        toast({
          title: "Comment deleted",
          description: "Your comment has been removed",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete comment",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Unable to delete comment",
        description: "Comments are temporarily unavailable.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4" data-testid={`comments-section-${bookId}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>
          {error
            ? "Comments temporarily unavailable"
            : `${comments.length} comment${comments.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
          {error}
        </div>
      ) : (
        <>
          {/* Add comment form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts about this book..."
            className="min-h-[80px] resize-none"
            maxLength={communityPolicy.maxCommentLength}
            disabled={isSubmitting}
            data-testid={`comment-input-${bookId}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            Up to {communityPolicy.maxCommentLength.toLocaleString()} characters
          </p>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || isSubmitting}
              className="btn-accent"
              data-testid={`post-comment-${bookId}`}
            >
              <Send className="mr-2 h-3.5 w-3.5" />
              {isSubmitting ? "Posting..." : "Post comment"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-md bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
          Sign in to add your thoughts and join the conversation
        </div>
      )}

          {/* Comments list */}
      {comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-md bg-secondary/30 p-4 space-y-2"
              data-testid={`comment-item-${bookId}`}
              data-comment-id={comment.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-accent" />
                  <span className="font-medium text-sm text-foreground">
                    {comment.userName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                {user && comment.userId === user.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(comment.id)}
                    className="h-auto p-1 text-muted-foreground hover:text-destructive"
                    data-testid={`delete-comment-${bookId}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {comment.text}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No comments yet. Be the first to share your thoughts!
        </div>
      )}
        </>
      )}
    </div>
  );
}
