export type WorkType =
  | "Novel"
  | "Play"
  | "Poem"
  | "Essay"
  | "Collection"
  | "Short Story"
  | "Other";

export type Book = {
  id: string;
  title: string;
  author: string;
  year?: number | null;
  era?: string | null;
  country?: string | null;
  category?: string | null;
  workType: WorkType;
  summary: string;
  authorBio: string;
  tags: string[];
  source?: string | null;
  publicDomain: boolean;
  publicDomainNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  searchIndex?: string;
  titleNormalized?: string;
  authorNormalized?: string;
};

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
}

export type ReadingListType = "wantToRead" | "currentlyReading" | "finished";

export interface FavoriteRecord {
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
}

export interface ReadingListRecord {
  id: string;
  userId: string;
  bookId: string;
  listType: ReadingListType;
  addedAt: string;
  finishedAt?: string;
  progress?: number;
}

export interface CommentRecord {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface RatingRecord {
  id: string;
  userId: string;
  bookId: string;
  rating: number;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  userId: string;
  userName: string;
  bookId: string;
  rating: number;
  review: string;
  createdAt: string;
  helpful: number;
}
