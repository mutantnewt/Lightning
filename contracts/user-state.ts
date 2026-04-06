import type {
  CommentRecord,
  FavoriteRecord,
  ReadingListRecord,
  ReadingListType,
  ReviewRecord,
} from "./domain";

export const communityPolicy = {
  defaultPageSize: 50,
  maxPageSize: 100,
  maxCommentLength: 2000,
  maxReviewLength: 5000,
} as const;

export interface FavoritesResponse {
  favorites: FavoriteRecord[];
}

export interface AddFavoriteRequest {
  bookId: string;
}

export interface RemoveFavoriteRequest {
  bookId: string;
}

export interface ReadingListsResponse {
  readingLists: ReadingListRecord[];
}

export interface UpsertReadingListRequest {
  bookId: string;
  listType: ReadingListType;
  progress?: number;
  finishedAt?: string | null;
}

export interface RemoveReadingListRequest {
  bookId: string;
}

export interface CommentsResponse {
  comments: CommentRecord[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

export interface CreateCommentRequest {
  text: string;
}

export interface RatingsSummaryResponse {
  averageRating: number;
  ratingCount: number;
}

export interface UserRatingResponse {
  rating: number;
}

export interface SetRatingRequest {
  rating: number;
}

export interface ReviewsResponse {
  reviews: ReviewRecord[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

export interface CreateReviewRequest {
  rating: number;
  review: string;
}
