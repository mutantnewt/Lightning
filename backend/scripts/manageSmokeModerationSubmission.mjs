import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");

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

function deriveRuntimeConfig() {
  const envFileValues = {
    ...parseEnvFile(join(backendRoot, ".env")),
    ...parseEnvFile(join(backendRoot, ".env.local")),
  };
  const merged = {
    ...envFileValues,
    ...process.env,
  };
  const envName = merged.APP_ENV ?? merged.LIGHTNING_ENV ?? "local";
  const region = merged.AWS_REGION ?? "eu-west-2";
  const tableName = merged.BOOK_SUGGESTIONS_TABLE_NAME;

  if (!tableName) {
    throw new Error(
      "Unable to resolve BOOK_SUGGESTIONS_TABLE_NAME from backend/.env, backend/.env.local, or process env.",
    );
  }

  return {
    envName,
    region,
    tableName,
  };
}

function deriveRequestedBy(options) {
  const identifier =
    options["requested-by-identifier"] ??
    process.env.LIGHTNING_SMOKE_IDENTIFIER ??
    "lightning-local-smoke@example.com";
  const username =
    options["requested-by-username"] ??
    process.env.LIGHTNING_SMOKE_COGNITO_USERNAME ??
    (identifier.includes("@")
      ? identifier.split("@", 1)[0].replace(/[^a-zA-Z0-9_-]/g, "_")
      : identifier);
  const email =
    options["requested-by-email"] ??
    (identifier.includes("@") ? identifier : `${username}@example.com`);
  const name =
    options["requested-by-name"] ??
    process.env.LIGHTNING_SMOKE_EXPECTED_USER ??
    "Local Smoke";
  const id =
    options["requested-by-id"] ??
    `smoke-user:${username}`;

  return {
    id,
    username,
    email,
    name,
  };
}

function buildSubmission(config, options) {
  const now = new Date().toISOString();
  const submissionId =
    options["submission-id"] ??
    `book-suggestion-submission:lightning-smoke-moderation-${config.envName}`;
  const title =
    options.title ??
    `Lightning Classics Smoke Moderation (${config.envName})`;
  const author = options.author ?? "Automation Harness";
  const requestedBy = deriveRequestedBy(options);
  const sourceAuditEntryId = options["source-audit-entry-id"] ?? null;

  return {
    id: submissionId,
    status: "pending_review",
    source: "offline",
    createdAt: now,
    updatedAt: now,
    sourceAuditEntryId,
    book: {
      id: `lightning-smoke-moderation-${config.envName}`,
      title,
      author,
      year: 1901,
      era: "Smoke Test",
      country: "N/A",
      category: "Automation",
      workType: "Other",
      summary:
        "Synthetic moderation probe used by Lightning Classics browser smoke tests. Reject or defer this record; do not publish it to the shared catalog.",
      authorBio:
        "Synthetic automation harness author used for deterministic moderation smoke coverage.",
      tags: ["smoke-test", "moderation"],
      source: "https://lightningclassics.com/internal/smoke-moderation",
      publicDomain: false,
      publicDomainNotes:
        "Synthetic smoke-only moderation submission. This record exists only to verify moderator decision workflows and must not be published.",
      createdAt: now,
      updatedAt: now,
    },
    requestedBy,
    moderationNotes: null,
    lastModeratedAt: null,
    lastModeratedByUserId: null,
    decisionAuditEntryId: null,
    acceptedAt: null,
    acceptedByUserId: null,
    acceptedBookId: null,
    acceptedAuditEntryId: null,
  };
}

function toSubmissionKey(submissionId) {
  return {
    pk: `SUBMISSION#${submissionId}`,
    sk: "META",
  };
}

async function getSubmission(client, tableName, submissionId) {
  const response = await client.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall(toSubmissionKey(submissionId)),
      ConsistentRead: true,
    }),
  );

  return response.Item ? unmarshall(response.Item) : null;
}

async function prepareSubmission(client, config, options) {
  const submission = buildSubmission(config, options);
  const item = {
    ...toSubmissionKey(submission.id),
    entityType: "bookSuggestionSubmission",
    ...submission,
  };

  await client.send(
    new PutItemCommand({
      TableName: config.tableName,
      Item: marshall(item, { removeUndefinedValues: true }),
    }),
  );

  return getSubmission(client, config.tableName, submission.id);
}

async function main() {
  const { action, options } = parseArgs(process.argv.slice(2));

  if (!["prepare", "status"].includes(action)) {
    throw new Error(`Unsupported action "${action}". Use prepare or status.`);
  }

  const config = deriveRuntimeConfig();
  const client = new DynamoDBClient({
    region: config.region,
  });

  const submissionId =
    options["submission-id"] ??
    `book-suggestion-submission:lightning-smoke-moderation-${config.envName}`;

  const submission =
    action === "prepare"
      ? await prepareSubmission(client, config, options)
      : await getSubmission(client, config.tableName, submissionId);

  console.log(
    JSON.stringify(
      {
        action,
        envName: config.envName,
        region: config.region,
        tableName: config.tableName,
        submissionId,
        submission,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Smoke moderation submission helper failed:", error);
  process.exitCode = 1;
});
