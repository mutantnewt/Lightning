import type { FavoriteRecord, ReadingListRecord, ReadingListType } from "../../../../contracts/domain";
import { getUserStateStore, type UserStateStore } from "../repositories/userStateStore";

let store: UserStateStore | null = null;

function getStore(): UserStateStore {
  if (!store) {
    store = getUserStateStore();
  }

  return store;
}

export async function listFavoritesForUser(
  userId: string,
): Promise<FavoriteRecord[]> {
  return getStore().listFavorites(userId);
}

export async function addFavoriteForUser(
  userId: string,
  bookId: string,
): Promise<void> {
  return getStore().addFavorite(userId, bookId);
}

export async function removeFavoriteForUser(
  userId: string,
  bookId: string,
): Promise<void> {
  return getStore().removeFavorite(userId, bookId);
}

export async function listReadingListsForUser(
  userId: string,
): Promise<ReadingListRecord[]> {
  return getStore().listReadingLists(userId);
}

export async function upsertReadingListForUser(
  userId: string,
  input: {
    bookId: string;
    listType: ReadingListType;
    progress?: number;
    finishedAt?: string | null;
  },
): Promise<void> {
  return getStore().upsertReadingList(userId, input);
}

export async function removeReadingListForUser(
  userId: string,
  bookId: string,
): Promise<void> {
  return getStore().removeReadingList(userId, bookId);
}
