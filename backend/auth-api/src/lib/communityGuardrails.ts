import { communityPolicy } from "../../../../contracts/user-state";

export interface CommunityListRequest {
  cursor?: string | null;
  limit?: number;
}

export interface CommunityListResult<
  TItem extends { id: string; createdAt: string },
> {
  items: TItem[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

interface CursorPayload {
  createdAt: string;
  id: string;
}

export class InvalidCommunityCursorError extends Error {
  constructor(message = "Invalid pagination cursor.") {
    super(message);
    this.name = "InvalidCommunityCursorError";
  }
}

export class DuplicateReviewError extends Error {
  constructor(message = "You can only keep one review per book.") {
    super(message);
    this.name = "DuplicateReviewError";
  }
}

export function normalizeCommunityPageSize(value: unknown): number | null {
  if (typeof value === "undefined" || value === null || value === "") {
    return communityPolicy.defaultPageSize;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.min(parsed, communityPolicy.maxPageSize);
}

export function validateCommentText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > communityPolicy.maxCommentLength) {
    return null;
  }

  return trimmed;
}

export function validateReviewText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > communityPolicy.maxReviewLength) {
    return null;
  }

  return trimmed;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<CursorPayload>;

    if (
      typeof parsed.createdAt !== "string" ||
      !parsed.createdAt ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      throw new InvalidCommunityCursorError();
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch (error) {
    if (error instanceof InvalidCommunityCursorError) {
      throw error;
    }

    throw new InvalidCommunityCursorError();
  }
}

function compareCreatedRecords(
  left: { createdAt: string; id: string },
  right: { createdAt: string; id: string },
): number {
  const createdAtCompare = right.createdAt.localeCompare(left.createdAt);

  if (createdAtCompare !== 0) {
    return createdAtCompare;
  }

  return right.id.localeCompare(left.id);
}

export function paginateCommunityItems<
  TItem extends { id: string; createdAt: string },
>(
  items: TItem[],
  request: CommunityListRequest = {},
): CommunityListResult<TItem> {
  const pageSize = request.limit ?? communityPolicy.defaultPageSize;
  const sortedItems = [...items].sort(compareCreatedRecords);

  let startIndex = 0;

  if (request.cursor) {
    const cursor = decodeCursor(request.cursor);
    const cursorIndex = sortedItems.findIndex(
      (item) => item.id === cursor.id && item.createdAt === cursor.createdAt,
    );

    if (cursorIndex === -1) {
      throw new InvalidCommunityCursorError();
    }

    startIndex = cursorIndex + 1;
  }

  const pagedItems = sortedItems.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pagedItems.length < sortedItems.length;
  const lastItem = pagedItems[pagedItems.length - 1];

  return {
    items: pagedItems,
    nextCursor: hasMore && lastItem ? encodeCursor(lastItem) : null,
    hasMore,
    pageSize,
  };
}
