import { useEffect, useState } from "react";
import type { ReadingListRecord, ReadingListType } from "@contracts/domain";
import { createUserStateClient } from "@/api/user-state";

const userStateClient = createUserStateClient();

export type { ReadingListType } from "@contracts/domain";
export type ReadingListItem = ReadingListRecord;

export function useReadingLists(userId?: string) {
  const [lists, setLists] = useState<ReadingListItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      setLists([]);
      return;
    }

    const loadReadingLists = async () => {
      try {
        const nextLists = await userStateClient.listReadingLists(userId);
        if (isMounted) {
          setLists(nextLists);
        }
      } catch (error) {
        console.error("Error loading reading lists:", error);
        if (isMounted) {
          setLists([]);
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

    await userStateClient.upsertReadingList(userId, {
      bookId,
      listType,
    });

    const nextLists = await userStateClient.listReadingLists(userId);
    setLists(nextLists);
    return true;
  };

  const removeFromList = async (bookId: string): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    await userStateClient.removeReadingList(userId, bookId);

    const nextLists = await userStateClient.listReadingLists(userId);
    setLists(nextLists);
    return true;
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

    await userStateClient.upsertReadingList(userId, {
      bookId,
      listType: existingItem.listType,
      progress: Math.max(0, Math.min(100, progress)),
      finishedAt: existingItem.finishedAt ?? null,
    });

    const nextLists = await userStateClient.listReadingLists(userId);
    setLists(nextLists);
    return true;
  };

  const markAsFinished = async (bookId: string): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    await userStateClient.upsertReadingList(userId, {
      bookId,
      listType: "finished",
      progress: 100,
      finishedAt: new Date().toISOString(),
    });

    const nextLists = await userStateClient.listReadingLists(userId);
    setLists(nextLists);
    return true;
  };

  return {
    lists,
    getBookList,
    addToList,
    removeFromList,
    updateProgress,
    markAsFinished,
  };
}
