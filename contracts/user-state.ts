import type {
  CommentRecord,
  FavoriteRecord,
  ReadingListRecord,
  ReadingListType,
  ReviewRecord,
} from "./domain";

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
}

export interface CreateReviewRequest {
  rating: number;
  review: string;
}
