import type { CommentRecord, ReviewRecord } from "@contracts/domain";

export interface RatingSummary {
  averageRating: number;
  ratingCount: number;
}

export interface CommunityPageRequest {
  cursor?: string | null;
  limit?: number;
}

export interface CommunityPage<TItem> {
  items: TItem[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

export interface CommunityClient {
  readonly mode: "local" | "http" | "disabled";
  subscribe(listener: () => void): () => void;
  listComments(
    bookId: string,
    request?: CommunityPageRequest,
  ): Promise<CommunityPage<CommentRecord>>;
  addComment(
    bookId: string,
    userId: string,
    userName: string,
    text: string,
  ): Promise<CommentRecord>;
  deleteComment(bookId: string, commentId: string, userId: string): Promise<boolean>;
  getRatingSummary(bookId: string): Promise<RatingSummary>;
  getUserRating(bookId: string, userId: string): Promise<number>;
  setRating(bookId: string, userId: string, rating: number): Promise<void>;
  listReviews(
    bookId: string,
    request?: CommunityPageRequest,
  ): Promise<CommunityPage<ReviewRecord>>;
  addReview(
    bookId: string,
    userId: string,
    userName: string,
    rating: number,
    review: string,
  ): Promise<ReviewRecord>;
  deleteReview(bookId: string, reviewId: string, userId: string): Promise<boolean>;
}
