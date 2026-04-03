import { useEffect, useState } from "react";
import type { CommentRecord } from "@contracts/domain";
import { createCommunityClient } from "@/api/community";

const communityClient = createCommunityClient();

export type Comment = CommentRecord;

export function useComments(bookId?: string) {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    let isMounted = true;

    if (!bookId) {
      setComments([]);
      return;
    }

    const loadComments = async () => {
      try {
        const nextComments = await communityClient.listComments(bookId);
        if (isMounted) {
          setComments(nextComments);
        }
      } catch (error) {
        console.error("Error loading comments:", error);
        if (isMounted) {
          setComments([]);
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

    const createdComment = await communityClient.addComment(
      bookId,
      userId,
      userName,
      text,
    );
    const nextComments = await communityClient.listComments(bookId);
    setComments(nextComments);
    return createdComment;
  };

  const deleteComment = async (
    commentId: string,
    userId: string,
  ): Promise<boolean> => {
    if (!bookId) {
      return false;
    }

    const deleted = await communityClient.deleteComment(bookId, commentId, userId);

    if (deleted) {
      const nextComments = await communityClient.listComments(bookId);
      setComments(nextComments);
    }

    return deleted;
  };

  return {
    comments,
    addComment,
    deleteComment,
  };
}
