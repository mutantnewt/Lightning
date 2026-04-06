import { useEffect, useState } from "react";
import type { ReadingListRecord, ReadingListType } from "@contracts/domain";
import { createUserStateClient } from "@/api/user-state";

const userStateClient = createUserStateClient();

export type { ReadingListType } from "@contracts/domain";
export type ReadingListItem = ReadingListRecord;

export function useReadingLists(userId?: string) {
  const [lists, setLists] = useState<ReadingListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      setLists([]);
      setError(null);
      return;
    }

    const loadReadingLists = async () => {
      try {
        const nextLists = await userStateClient.listReadingLists(userId);
        if (isMounted) {
          setLists(nextLists);
          setError(null);
        }
      } catch (error) {
        console.error("Error loading reading lists:", error);
        if (isMounted) {
          setLists([]);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load reading lists right now.",
          );
        }
      }
    };

    void loadReadingLists();

    const unsubscribe = userStateClient.subscribe(() => {
      void loadReadingLists();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  const getBookList = (bookId: string): ReadingListType | null => {
    if (!userId) {
      return null;
    }

    const item = lists.find((listItem) => listItem.bookId === bookId);
    return item ? item.listType : null;
  };

  const addToList = async (
    bookId: string,
    listType: ReadingListType
  ): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    try {
      await userStateClient.upsertReadingList(userId, {
        bookId,
        listType,
      });

      const nextLists = await userStateClient.listReadingLists(userId);
      setLists(nextLists);
      setError(null);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update reading lists right now.",
      );
      throw error;
    }
  };

  const removeFromList = async (bookId: string): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    try {
      await userStateClient.removeReadingList(userId, bookId);

      const nextLists = await userStateClient.listReadingLists(userId);
      setLists(nextLists);
      setError(null);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update reading lists right now.",
      );
      throw error;
    }
  };

  const updateProgress = async (
    bookId: string,
    progress: number
  ): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    const existingItem = lists.find((item) => item.bookId === bookId);
    if (!existingItem) {
      return false;
    }

    try {
      await userStateClient.upsertReadingList(userId, {
        bookId,
        listType: existingItem.listType,
        progress: Math.max(0, Math.min(100, progress)),
        finishedAt: existingItem.finishedAt ?? null,
      });

      const nextLists = await userStateClient.listReadingLists(userId);
      setLists(nextLists);
      setError(null);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update reading lists right now.",
      );
      throw error;
    }
  };

  const markAsFinished = async (bookId: string): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    try {
      await userStateClient.upsertReadingList(userId, {
        bookId,
        listType: "finished",
        progress: 100,
        finishedAt: new Date().toISOString(),
      });

      const nextLists = await userStateClient.listReadingLists(userId);
      setLists(nextLists);
      setError(null);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update reading lists right now.",
      );
      throw error;
    }
  };

  return {
    lists,
    error,
    getBookList,
    addToList,
    removeFromList,
    updateProgress,
    markAsFinished,
  };
}
