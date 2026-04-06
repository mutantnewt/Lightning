import { useEffect, useState } from "react";
import type { CommentRecord } from "@contracts/domain";
import { communityPolicy } from "@contracts/user-state";
import { createCommunityClient } from "@/api/community";

const communityClient = createCommunityClient();

export type Comment = CommentRecord;

export function useComments(bookId?: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!bookId) {
      setComments([]);
      setError(null);
      setNextCursor(null);
      setHasMore(false);
      setIsLoadingMore(false);
      return;
    }

    const loadComments = async () => {
      try {
        const response = await communityClient.listComments(bookId, {
          limit: communityPolicy.defaultPageSize,
        });
        if (isMounted) {
          setComments(response.items);
          setError(null);
          setNextCursor(response.nextCursor);
          setHasMore(response.hasMore);
          setIsLoadingMore(false);
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
          setNextCursor(null);
          setHasMore(false);
          setIsLoadingMore(false);
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
      const response = await communityClient.listComments(bookId, {
        limit: communityPolicy.defaultPageSize,
      });
      setComments(response.items);
      setError(null);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
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
        const response = await communityClient.listComments(bookId, {
          limit: communityPolicy.defaultPageSize,
        });
        setComments(response.items);
        setError(null);
        setNextCursor(response.nextCursor);
        setHasMore(response.hasMore);
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

  const loadMore = async (): Promise<void> => {
    if (!bookId || !hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const response = await communityClient.listComments(bookId, {
        cursor: nextCursor,
        limit: communityPolicy.defaultPageSize,
      });

      setComments((currentComments) => [...currentComments, ...response.items]);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load more comments right now.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    comments,
    error,
    hasMore,
    isLoadingMore,
    addComment,
    deleteComment,
    loadMore,
  };
}
