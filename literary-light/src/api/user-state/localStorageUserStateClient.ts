import type { FavoriteRecord, ReadingListRecord } from "@contracts/domain";
import type { UserStateClient, UpsertReadingListInput } from "./client";

const FAVORITES_STORAGE_KEY = "literary-light-favorites";
const READING_LISTS_STORAGE_KEY = "literary-light-reading-lists";

function getStoredItems<T>(storageKey: string): T[] {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as T[]) : [];
  } catch {
    return [];
  }
}

function setStoredItems<T>(storageKey: string, items: T[]): void {
  localStorage.setItem(storageKey, JSON.stringify(items));
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class LocalStorageUserStateClient implements UserStateClient {
  readonly mode = "local" as const;

  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  async listFavorites(userId: string): Promise<FavoriteRecord[]> {
    return getStoredItems<FavoriteRecord>(FAVORITES_STORAGE_KEY).filter(
      (favorite) => favorite.userId === userId
    );
  }

  async addFavorite(userId: string, bookId: string): Promise<void> {
    const favorites = getStoredItems<FavoriteRecord>(FAVORITES_STORAGE_KEY);
    const alreadyExists = favorites.some(
      (favorite) => favorite.userId === userId && favorite.bookId === bookId
    );

    if (alreadyExists) {
      return;
    }

    setStoredItems(FAVORITES_STORAGE_KEY, [
      ...favorites,
      {
        id: createId("fav"),
        userId,
        bookId,
        createdAt: new Date().toISOString(),
      },
    ]);
    this.notify();
  }

  async removeFavorite(userId: string, bookId: string): Promise<void> {
    const favorites = getStoredItems<FavoriteRecord>(FAVORITES_STORAGE_KEY);

    setStoredItems(
      FAVORITES_STORAGE_KEY,
      favorites.filter(
        (favorite) => !(favorite.userId === userId && favorite.bookId === bookId)
      )
    );
    this.notify();
  }

  async listReadingLists(userId: string): Promise<ReadingListRecord[]> {
    return getStoredItems<ReadingListRecord>(READING_LISTS_STORAGE_KEY).filter(
      (item) => item.userId === userId
    );
  }

  async upsertReadingList(
    userId: string,
    input: UpsertReadingListInput
  ): Promise<void> {
    const items = getStoredItems<ReadingListRecord>(READING_LISTS_STORAGE_KEY);
    const remainingItems = items.filter(
      (item) => !(item.userId === userId && item.bookId === input.bookId)
    );
    const existingItem = items.find(
      (item) => item.userId === userId && item.bookId === input.bookId
    );

    setStoredItems(READING_LISTS_STORAGE_KEY, [
      ...remainingItems,
      {
        id: existingItem?.id ?? createId("list"),
        userId,
        bookId: input.bookId,
        listType: input.listType,
        addedAt: existingItem?.addedAt ?? new Date().toISOString(),
        progress: input.progress,
        finishedAt: input.finishedAt ?? undefined,
      },
    ]);
    this.notify();
  }

  async removeReadingList(userId: string, bookId: string): Promise<void> {
    const items = getStoredItems<ReadingListRecord>(READING_LISTS_STORAGE_KEY);

    setStoredItems(
      READING_LISTS_STORAGE_KEY,
      items.filter(
        (item) => !(item.userId === userId && item.bookId === bookId)
      )
    );
    this.notify();
  }
}
