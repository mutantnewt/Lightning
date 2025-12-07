import { useState, useEffect } from "react";

const READING_LISTS_STORAGE_KEY = "literary-light-reading-lists";
const LISTS_CHANGE_EVENT = "reading-lists-changed";

export type ReadingListType = "wantToRead" | "currentlyReading" | "finished";

export interface ReadingListItem {
  id: string;
  userId: string;
  bookId: string;
  listType: ReadingListType;
  addedAt: string;
  finishedAt?: string;
  progress?: number;
}

function getStoredLists(): ReadingListItem[] {
  try {
    const stored = localStorage.getItem(READING_LISTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading reading lists:", error);
    return [];
  }
}

function saveLists(lists: ReadingListItem[]) {
  try {
    localStorage.setItem(READING_LISTS_STORAGE_KEY, JSON.stringify(lists));
    window.dispatchEvent(new CustomEvent(LISTS_CHANGE_EVENT));
  } catch (error) {
    console.error("Error saving reading lists:", error);
  }
}

export function useReadingLists(userId?: string) {
  const [allLists, setAllLists] = useState<ReadingListItem[]>([]);

  useEffect(() => {
    setAllLists(getStoredLists());

    const handleListsChange = () => {
      setAllLists(getStoredLists());
    };

    window.addEventListener(LISTS_CHANGE_EVENT, handleListsChange);
    return () => {
      window.removeEventListener(LISTS_CHANGE_EVENT, handleListsChange);
    };
  }, []);

  const userLists = userId
    ? allLists.filter((item) => item.userId === userId)
    : [];

  const getBookList = (bookId: string): ReadingListType | null => {
    if (!userId) return null;
    const item = userLists.find((item) => item.bookId === bookId);
    return item ? item.listType : null;
  };

  const addToList = (bookId: string, listType: ReadingListType): boolean => {
    if (!userId) return false;

    const filtered = allLists.filter(
      (item) => !(item.userId === userId && item.bookId === bookId)
    );

    const newItem: ReadingListItem = {
      id: `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      bookId,
      listType,
      addedAt: new Date().toISOString(),
    };

    const updated = [...filtered, newItem];
    setAllLists(updated);
    saveLists(updated);
    return true;
  };

  const removeFromList = (bookId: string): boolean => {
    if (!userId) return false;

    const updated = allLists.filter(
      (item) => !(item.userId === userId && item.bookId === bookId)
    );
    setAllLists(updated);
    saveLists(updated);
    return true;
  };

  const updateProgress = (bookId: string, progress: number): boolean => {
    if (!userId) return false;

    const updated = allLists.map((item) =>
      item.userId === userId && item.bookId === bookId
        ? { ...item, progress: Math.max(0, Math.min(100, progress)) }
        : item
    );
    setAllLists(updated);
    saveLists(updated);
    return true;
  };

  const markAsFinished = (bookId: string): boolean => {
    if (!userId) return false;

    const updated = allLists.map((item) =>
      item.userId === userId && item.bookId === bookId
        ? {
            ...item,
            listType: "finished" as ReadingListType,
            finishedAt: new Date().toISOString(),
            progress: 100,
          }
        : item
    );
    setAllLists(updated);
    saveLists(updated);
    return true;
  };

  return {
    lists: userLists,
    getBookList,
    addToList,
    removeFromList,
    updateProgress,
    markAsFinished,
  };
}
