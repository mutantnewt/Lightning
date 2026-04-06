import type { FavoriteRecord, ReadingListRecord, ReadingListType } from "@contracts/domain";

export interface UpsertReadingListInput {
  bookId: string;
  listType: ReadingListType;
  progress?: number;
  finishedAt?: string | null;
}

export interface UserStateClient {
  readonly mode: "local" | "http" | "disabled";
  subscribe(listener: () => void): () => void;
  listFavorites(userId: string): Promise<FavoriteRecord[]>;
  addFavorite(userId: string, bookId: string): Promise<void>;
  removeFavorite(userId: string, bookId: string): Promise<void>;
  listReadingLists(userId: string): Promise<ReadingListRecord[]>;
  upsertReadingList(
    userId: string,
    input: UpsertReadingListInput
  ): Promise<void>;
  removeReadingList(userId: string, bookId: string): Promise<void>;
}
