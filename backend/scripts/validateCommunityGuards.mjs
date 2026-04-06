import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

async function loadModule(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return import(pathToFileURL(absolutePath).href);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "lightning-community-guards-"),
  );
  const stateFilePath = path.join(tempDir, "lightning-user-state-local.json");

  process.env.LOCAL_STATE_FILE = stateFilePath;

  const [{ LocalUserStateRepository }, { communityPolicy }] = await Promise.all([
    loadModule("./dist/backend/auth-api/src/repositories/localUserStateRepository.js"),
    loadModule("./dist/contracts/user-state.js"),
  ]);

  const repository = new LocalUserStateRepository();
  const bookId = "book-guardrails";
  const userId = "user-guardrails";
  const userName = "Guard Rails";
  const totalComments = communityPolicy.defaultPageSize + 5;

  try {
    for (let index = 0; index < totalComments; index += 1) {
      await repository.addComment(
        `comment-user-${index}`,
        `Comment User ${index}`,
        bookId,
        `Comment ${index + 1}`,
      );
    }

    const firstPage = await repository.listComments(bookId, {
      limit: communityPolicy.defaultPageSize,
    });

    assert(
      firstPage.items.length === communityPolicy.defaultPageSize,
      `Expected first page to contain ${communityPolicy.defaultPageSize} comments.`,
    );
    assert(firstPage.hasMore, "Expected first page to report hasMore.");
    assert(firstPage.nextCursor, "Expected first page to include nextCursor.");

    const secondPage = await repository.listComments(bookId, {
      cursor: firstPage.nextCursor,
      limit: communityPolicy.defaultPageSize,
    });

    assert(
      secondPage.items.length === totalComments - communityPolicy.defaultPageSize,
      "Expected second page to contain the remaining comments.",
    );
    assert(!secondPage.hasMore, "Expected second page to end pagination.");
    assert(
      secondPage.nextCursor === null,
      "Expected second page nextCursor to be null.",
    );

    await repository.addReview(userId, userName, bookId, 5, "First review");

    let duplicateReviewBlocked = false;

    try {
      await repository.addReview(userId, userName, bookId, 4, "Duplicate review");
    } catch (error) {
      duplicateReviewBlocked = error?.name === "DuplicateReviewError";
    }

    assert(
      duplicateReviewBlocked,
      "Expected duplicate review creation to be blocked.",
    );

    console.log(
      JSON.stringify({
        ok: true,
        commentPagination: {
          totalComments,
          firstPageSize: firstPage.items.length,
          secondPageSize: secondPage.items.length,
        },
        duplicateReviewBlocked,
      }),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
