import { useState, useEffect } from "react";

const COMMENTS_STORAGE_KEY = "literary-light-comments";

export interface Comment {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

function getStoredComments(): Comment[] {
  try {
    const stored = localStorage.getItem(COMMENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading comments:", error);
    return [];
  }
}

function saveComments(comments: Comment[]) {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
  } catch (error) {
    console.error("Error saving comments:", error);
  }
}

export function useComments(bookId?: string) {
  const [allComments, setAllComments] = useState<Comment[]>([]);

  useEffect(() => {
    setAllComments(getStoredComments());
  }, []);

  const bookComments = bookId
    ? allComments.filter((c) => c.bookId === bookId).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  const addComment = (bookId: string, userId: string, userName: string, text: string): Comment => {
    const newComment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      bookId,
      userId,
      userName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [...allComments, newComment];
    setAllComments(updated);
    saveComments(updated);

    return newComment;
  };

  const deleteComment = (commentId: string, userId: string): boolean => {
    const comment = allComments.find((c) => c.id === commentId);

    // Only allow deleting your own comments
    if (!comment || comment.userId !== userId) {
      return false;
    }

    const updated = allComments.filter((c) => c.id !== commentId);
    setAllComments(updated);
    saveComments(updated);

    return true;
  };

  const getCommentCount = (bookId: string): number => {
    return allComments.filter((c) => c.bookId === bookId).length;
  };

  return {
    comments: bookComments,
    addComment,
    deleteComment,
    getCommentCount,
  };
}
