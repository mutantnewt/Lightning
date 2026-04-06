import { useEffect, useState } from "react";
import type { CommentRecord } from "@contracts/domain";
import { createCommunityClient } from "@/api/community";

const communityClient = createCommunityClient();

export type Comment = CommentRecord;

export function useComments(bookId?: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!bookId) {
      setComments([]);
      setError(null);
      return;
    }

    const loadComments = async () => {
      try {
        const nextComments = await communityClient.listComments(bookId);
        if (isMounted) {
          setComments(nextComments);
          setError(null);
        }
      } catch (error) {
        console.error("Error loading comments:", error);
        if (isMounted) {
          setComments([]);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load comments right now.",
          );
        }
      }
    };

    void loadComments();

    const unsubscribe = communityClient.subscribe(() => {
      void loadComments();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [bookId]);

  const addComment = async (
    userId: string,
    userName: string,
    text: string,
  ): Promise<Comment> => {
    if (!bookId) {
      throw new Error("Book ID is required to add a comment.");
    }

    try {
      const createdComment = await communityClient.addComment(
        bookId,
        userId,
        userName,
        text,
      );
      const nextComments = await communityClient.listComments(bookId);
      setComments(nextComments);
      setError(null);
      return createdComment;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to add your comment right now.",
      );
      throw error;
    }
  };

  const deleteComment = async (
    commentId: string,
    userId: string,
  ): Promise<boolean> => {
    if (!bookId) {
      return false;
    }

    try {
      const deleted = await communityClient.deleteComment(bookId, commentId, userId);

      if (deleted) {
        const nextComments = await communityClient.listComments(bookId);
        setComments(nextComments);
        setError(null);
      }

      return deleted;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update comments right now.",
      );
      throw error;
    }
  };

  return {
    comments,
    error,
    addComment,
    deleteComment,
  };
}
