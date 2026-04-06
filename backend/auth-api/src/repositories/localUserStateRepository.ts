import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CommentRecord,
  FavoriteRecord,
  ReadingListRecord,
  ReadingListType,
  ReviewRecord,
  RatingRecord,
} from "../../../../contracts/domain";
import type {
  CommunityListRequest,
  CommunityListResult,
} from "../lib/communityGuardrails";
import { paginateCommunityItems } from "../lib/communityGuardrails";
import { getEnv } from "../../../shared/env";

interface UserStateFile {
  favorites: FavoriteRecord[];
  readingLists: ReadingListRecord[];
  comments: CommentRecord[];
  ratings: RatingRecord[];
  reviews: ReviewRecord[];
}

const DEFAULT_LOCAL_STATE_FILE = path.resolve(
  process.cwd(),
  ".local",
  "lightning-user-state-local.json",
);

function getStateFilePath(): string {
  return getEnv("LOCAL_STATE_FILE") ?? DEFAULT_LOCAL_STATE_FILE;
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export class LocalUserStateRepository {
  private readonly stateFilePath = getStateFilePath();
  private writeChain: Promise<void> = Promise.resolve();

  private createId(prefix: string): string {
    return `${prefix}:${randomUUID()}`;
  }

  private async readState(): Promise<UserStateFile> {
    try {
      const contents = await fs.readFile(this.stateFilePath, "utf8");
      const parsed = JSON.parse(contents) as Partial<UserStateFile>;

      return {
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        readingLists: Array.isArray(parsed.readingLists) ? parsed.readingLists : [],
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        ratings: Array.isArray(parsed.ratings) ? parsed.ratings : [],
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          favorites: [],
          readingLists: [],
          comments: [],
          ratings: [],
          reviews: [],
        };
      }

      throw error;
    }
  }

  private async writeState(state: UserStateFile): Promise<void> {
    await ensureParentDirectory(this.stateFilePath);
    await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), "utf8");
  }

  private async updateState(
    updater: (current: UserStateFile) => UserStateFile | Promise<UserStateFile>,
  ): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      const current = await this.readState();
      const next = await updater(current);
      await this.writeState(next);
    });

    return this.writeChain;
  }

  private async updateStateWithResult<T>(
    updater: (
      current: UserStateFile,
    ) => { nextState: UserStateFile; result: T } | Promise<{ nextState: UserStateFile; result: T }>,
  ): Promise<T> {
    let result!: T;

    this.writeChain = this.writeChain.then(async () => {
      const current = await this.readState();
      const next = await updater(current);
      result = next.result;
      await this.writeState(next.nextState);
    });

    await this.writeChain;
    return result;
  }

  async listFavorites(userId: string): Promise<FavoriteRecord[]> {
    const state = await this.readState();

    return state.favorites
      .filter((favorite) => favorite.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async addFavorite(userId: string, bookId: string): Promise<void> {
    await this.updateState((state) => {
      const alreadyExists = state.favorites.some(
        (favorite) => favorite.userId === userId && favorite.bookId === bookId,
      );

      if (alreadyExists) {
        return state;
      }

      return {
        ...state,
        favorites: [
          ...state.favorites,
          {
            id: `favorite:${userId}:${bookId}`,
            userId,
            bookId,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  }

  async removeFavorite(userId: string, bookId: string): Promise<void> {
    await this.updateState((state) => ({
      ...state,
      favorites: state.favorites.filter(
        (favorite) => !(favorite.userId === userId && favorite.bookId === bookId),
      ),
    }));
  }

  async listReadingLists(userId: string): Promise<ReadingListRecord[]> {
    const state = await this.readState();

    return state.readingLists
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
  }

  async upsertReadingList(
    userId: string,
    input: {
      bookId: string;
      listType: ReadingListType;
      progress?: number;
      finishedAt?: string | null;
    },
  ): Promise<void> {
    await this.updateState((state) => {
      const existingItem = state.readingLists.find(
        (item) => item.userId === userId && item.bookId === input.bookId,
      );
      const readingLists = state.readingLists.filter(
        (item) => !(item.userId === userId && item.bookId === input.bookId),
      );

      return {
        ...state,
        readingLists: [
          ...readingLists,
          {
            id: existingItem?.id ?? `reading-list:${userId}:${input.bookId}`,
            userId,
            bookId: input.bookId,
            listType: input.listType,
            addedAt: existingItem?.addedAt ?? new Date().toISOString(),
            ...(typeof input.progress === "number" ? { progress: input.progress } : {}),
            ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
          },
        ],
      };
    });
  }

  async removeReadingList(userId: string, bookId: string): Promise<void> {
    await this.updateState((state) => ({
      ...state,
      readingLists: state.readingLists.filter(
        (item) => !(item.userId === userId && item.bookId === bookId),
      ),
    }));
  }

  async listComments(
    bookId: string,
    request?: CommunityListRequest,
  ): Promise<CommunityListResult<CommentRecord>> {
    const state = await this.readState();

    return paginateCommunityItems(
      state.comments.filter((comment) => comment.bookId === bookId),
      request,
    );
  }

  async addComment(
    userId: string,
    userName: string,
    bookId: string,
    text: string,
  ): Promise<CommentRecord> {
    const createdComment: CommentRecord = {
      id: this.createId("comment"),
      bookId,
      userId,
      userName,
      text,
      createdAt: new Date().toISOString(),
    };

    return this.updateStateWithResult((state) => ({
      nextState: {
        ...state,
        comments: [...state.comments, createdComment],
      },
      result: createdComment,
    }));
  }

  async removeComment(
    userId: string,
    bookId: string,
    commentId: string,
  ): Promise<boolean> {
    return this.updateStateWithResult((state) => {
      const targetComment = state.comments.find(
        (comment) => comment.bookId === bookId && comment.id === commentId,
      );

      if (!targetComment || targetComment.userId !== userId) {
        return {
          nextState: state,
          result: false,
        };
      }

      return {
        nextState: {
          ...state,
          comments: state.comments.filter((comment) => comment.id !== commentId),
        },
        result: true,
      };
    });
  }

  async getRatingSummary(
    bookId: string,
  ): Promise<{ averageRating: number; ratingCount: number }> {
    const state = await this.readState();
    const ratings = state.ratings.filter((rating) => rating.bookId === bookId);
    const ratingCount = ratings.length;
    const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);

    return {
      averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
      ratingCount,
    };
  }

  async getUserRating(userId: string, bookId: string): Promise<number> {
    const state = await this.readState();
    const rating = state.ratings.find(
      (item) => item.userId === userId && item.bookId === bookId,
    );

    return rating?.rating ?? 0;
  }

  async setRating(userId: string, bookId: string, rating: number): Promise<void> {
    await this.updateState((state) => {
      const existingRating = state.ratings.find(
        (item) => item.userId === userId && item.bookId === bookId,
      );
      const remainingRatings = state.ratings.filter(
        (item) => !(item.userId === userId && item.bookId === bookId),
      );

      return {
        ...state,
        ratings: [
          ...remainingRatings,
          {
            id: existingRating?.id ?? this.createId("rating"),
            userId,
            bookId,
            rating,
            createdAt: existingRating?.createdAt ?? new Date().toISOString(),
          },
        ],
      };
    });
  }

  async listReviews(
    bookId: string,
    request?: CommunityListRequest,
  ): Promise<CommunityListResult<ReviewRecord>> {
    const state = await this.readState();

    return paginateCommunityItems(
      state.reviews.filter((review) => review.bookId === bookId),
      request,
    );
  }

  async addReview(
    userId: string,
    userName: string,
    bookId: string,
    rating: number,
    review: string,
  ): Promise<ReviewRecord> {
    const createdReview: ReviewRecord = {
      id: this.createId("review"),
      userId,
      userName,
      bookId,
      rating,
      review,
      createdAt: new Date().toISOString(),
      helpful: 0,
    };

    return this.updateStateWithResult((state) => ({
      nextState: {
        ...state,
        reviews: [...state.reviews, createdReview],
      },
      result: createdReview,
    }));
  }

  async removeReview(
    userId: string,
    bookId: string,
    reviewId: string,
  ): Promise<boolean> {
    return this.updateStateWithResult((state) => {
      const targetReview = state.reviews.find(
        (review) => review.bookId === bookId && review.id === reviewId,
      );

      if (!targetReview || targetReview.userId !== userId) {
        return {
          nextState: state,
          result: false,
        };
      }

      return {
        nextState: {
          ...state,
          reviews: state.reviews.filter((review) => review.id !== reviewId),
        },
        result: true,
      };
    });
  }
}
