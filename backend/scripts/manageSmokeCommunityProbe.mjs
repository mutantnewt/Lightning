import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");
const probeUserPrefix = "smoke-community-probe";

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return {
    action: positional[0] ?? "status",
    options,
  };
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const contents = readFileSync(filePath, "utf8");
  const values = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function deriveRuntimeConfig(options) {
  const envFileValues = {
    ...parseEnvFile(join(backendRoot, ".env")),
    ...parseEnvFile(join(backendRoot, ".env.local")),
  };
  const merged = {
    ...envFileValues,
    ...process.env,
  };
  const envName =
    options.env ??
    merged.LIGHTNING_SMOKE_ENV ??
    merged.LIGHTNING_ENV ??
    merged.APP_ENV ??
    merged.LIGHTNING_BOOTSTRAP_ENV ??
    "local";
  const region = options.region ?? merged.AWS_REGION ?? "eu-west-2";
  const smokeScopedTableName =
    options["table-name"] ?? merged.LIGHTNING_SMOKE_USER_STATE_TABLE_NAME;
  const tableName =
    smokeScopedTableName ??
    (merged.LIGHTNING_SMOKE_ENV
      ? `lightning-user-state-${envName}`
      : merged.USER_STATE_TABLE_NAME ?? `lightning-user-state-${envName}`);

  return {
    envName,
    region,
    tableName,
  };
}

function deriveProbeConfig(config, options) {
  const bookId =
    options["book-id"] ??
    process.env.LIGHTNING_SMOKE_EXPECTED_FAVORITE_BOOK_ID ??
    "1";
  const smokeUserName =
    options["smoke-user-name"] ??
    process.env.LIGHTNING_SMOKE_EXPECTED_USER ??
    "Local Smoke";
  const commentCount = Math.max(
    Number.parseInt(
      options["comment-count"] ??
        process.env.LIGHTNING_SMOKE_PAGINATION_COMMENT_COUNT ??
        "55",
      10,
    ) || 55,
    51,
  );
  const commentPrefix =
    options["comment-prefix"] ??
    `Lightning smoke pagination comment (${config.envName})`;

  return {
    bookId,
    smokeUserName,
    commentCount,
    commentPrefix,
  };
}

function getBookPartitionKey(bookId) {
  return `BOOK#${bookId}`;
}

function getCommentSortKey(commentId) {
  return `COMMENT#${commentId}`;
}

function getReviewSortKey(reviewId) {
  return `REVIEW#${reviewId}`;
}

async function listBookItems(client, tableName, bookId, skPrefix) {
  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": getBookPartitionKey(bookId),
        ":skPrefix": skPrefix,
      },
    }),
  );

  return response.Items ?? [];
}

async function deleteItems(client, tableName, items) {
  for (const item of items) {
    await client.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          pk: item.pk,
          sk: item.sk,
        },
      }),
    );
  }
}

function buildProbeComment(config, probe, index, baseTimestampMs) {
  const sequence = String(index + 1).padStart(2, "0");
  const id = `comment:${probeUserPrefix}:${config.envName}:${sequence}`;

  return {
    pk: getBookPartitionKey(probe.bookId),
    sk: getCommentSortKey(id),
    entityType: "comment",
    id,
    bookId: probe.bookId,
    userId: `${probeUserPrefix}:${config.envName}:${sequence}`,
    userName: `Smoke Comment ${sequence}`,
    text: `${probe.commentPrefix} #${sequence}`,
    createdAt: new Date(baseTimestampMs + index * 1_000).toISOString(),
  };
}

async function prepareProbe(client, config, probe) {
  const [existingComments, existingReviews] = await Promise.all([
    listBookItems(client, config.tableName, probe.bookId, "COMMENT#"),
    listBookItems(client, config.tableName, probe.bookId, "REVIEW#"),
  ]);

  const probeCommentsToDelete = existingComments.filter(
    (item) =>
      typeof item.userId === "string" &&
      item.userId.startsWith(`${probeUserPrefix}:${config.envName}:`),
  );
  const smokeReviewsToDelete = existingReviews.filter(
    (item) =>
      typeof item.userName === "string" && item.userName === probe.smokeUserName,
  );

  await deleteItems(client, config.tableName, [
    ...probeCommentsToDelete,
    ...smokeReviewsToDelete,
  ]);

  const baseTimestampMs = Date.now() - probe.commentCount * 1_000;
  const seededComments = [];

  for (let index = 0; index < probe.commentCount; index += 1) {
    const comment = buildProbeComment(config, probe, index, baseTimestampMs);
    await client.send(
      new PutCommand({
        TableName: config.tableName,
        Item: comment,
      }),
    );
    seededComments.push(comment);
  }

  const pageTwoProbeText = seededComments[0]?.text ?? null;
  const firstPageLastText =
    seededComments[seededComments.length - 50]?.text ?? null;

  return {
    deletedProbeCommentCount: probeCommentsToDelete.length,
    deletedSmokeReviewCount: smokeReviewsToDelete.length,
    seededCommentCount: seededComments.length,
    firstPageLastText,
    pageTwoProbeText,
    loadMoreExpected: seededComments.length > 50,
  };
}

async function getProbeStatus(client, config, probe) {
  const [comments, reviews] = await Promise.all([
    listBookItems(client, config.tableName, probe.bookId, "COMMENT#"),
    listBookItems(client, config.tableName, probe.bookId, "REVIEW#"),
  ]);

  const probeCommentCount = comments.filter(
    (item) =>
      typeof item.userId === "string" &&
      item.userId.startsWith(`${probeUserPrefix}:${config.envName}:`),
  ).length;
  const smokeReviewCount = reviews.filter(
    (item) =>
      typeof item.userName === "string" && item.userName === probe.smokeUserName,
  ).length;

  return {
    probeCommentCount,
    smokeReviewCount,
    loadMoreExpected: probeCommentCount > 50,
  };
}

async function main() {
  const { action, options } = parseArgs(process.argv.slice(2));

  if (!["prepare", "status"].includes(action)) {
    throw new Error(`Unsupported action "${action}". Use prepare or status.`);
  }

  const config = deriveRuntimeConfig(options);
  const probe = deriveProbeConfig(config, options);
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: config.region,
    }),
  );

  const result =
    action === "prepare"
      ? await prepareProbe(client, config, probe)
      : await getProbeStatus(client, config, probe);

  console.log(
    JSON.stringify(
      {
        action,
        envName: config.envName,
        region: config.region,
        tableName: config.tableName,
        bookId: probe.bookId,
        smokeUserName: probe.smokeUserName,
        commentPrefix: probe.commentPrefix,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Smoke community probe helper failed:", error);
  process.exitCode = 1;
});
