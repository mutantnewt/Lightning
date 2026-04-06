import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");
const repoRoot = join(backendRoot, "..");
const awsBin = process.env.AWS_BIN ?? process.env.AWS_CLI_BIN ?? "aws";
const runtimePath = [
  awsBin.includes("/") ? dirname(awsBin) : "",
  "/usr/local/bin",
  "/opt/homebrew/bin",
  process.env.PATH ?? "",
]
  .filter(Boolean)
  .join(":");

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
    action: positional[0] ?? "ensure",
    options,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
        PATH: runtimePath,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
        return;
      }

      reject(
        new Error(
          [
            `Command failed: ${command} ${args.join(" ")}`,
            stdout.trim(),
            stderr.trim(),
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });
}

async function runAws(args) {
  const result = await run(awsBin, args);
  return result.stdout ? JSON.parse(result.stdout) : {};
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

function outputsToMap(outputs) {
  return Object.fromEntries(
    (outputs ?? [])
      .filter((entry) => entry.OutputKey && entry.OutputValue)
      .map((entry) => [entry.OutputKey, entry.OutputValue]),
  );
}

async function describeStack(stackName, region) {
  try {
    const response = await runAws([
      "cloudformation",
      "describe-stacks",
      "--region",
      region,
      "--stack-name",
      stackName,
    ]);

    return response.Stacks?.[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      return null;
    }

    throw error;
  }
}

function deriveImmutableSmokeUsername(identifier) {
  const source = identifier.includes("@")
    ? identifier.split("@", 1)[0]
    : identifier;
  const withoutLightningPrefix = source.replace(/^lightning[-_]?/iu, "");
  const normalized = withoutLightningPrefix
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const base = normalized || "local_smoke";

  return base.startsWith("lc_") ? base : `lc_${base}`;
}

function getUserAttribute(user, name) {
  const attributes = user.UserAttributes ?? user.Attributes ?? [];
  return attributes.find((attribute) => attribute.Name === name)?.Value ?? null;
}

async function resolveRuntimeConfig(options) {
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
  const stackName = merged.LIGHTNING_CDK_STACK_NAME ?? "LightningLocalStack";
  const stack = await describeStack(stackName, region);
  const outputMap = outputsToMap(stack?.Outputs);
  const userPoolId =
    options["user-pool-id"] ??
    merged.COGNITO_USER_POOL_ID ??
    merged.VITE_COGNITO_USER_POOL_ID ??
    outputMap.UserPoolId ??
    null;
  const userStateTableName =
    options["user-state-table"] ??
    merged.USER_STATE_TABLE_NAME ??
    outputMap.UserStateTableName ??
    null;
  const moderatorGroupName =
    options["group-name"] ??
    merged.CATALOG_MODERATOR_GROUP_NAME ??
    merged.VITE_CATALOG_MODERATOR_GROUP_NAME ??
    outputMap.CatalogModeratorGroupName ??
    `lightning-catalog-moderators-${envName}`;

  if (!userPoolId) {
    throw new Error(
      "Unable to resolve a Cognito user pool ID. Ensure backend/.env.local is current or LightningLocalStack exists.",
    );
  }

  if (!userStateTableName) {
    throw new Error(
      "Unable to resolve USER_STATE_TABLE_NAME. Ensure backend/.env.local is current or LightningLocalStack exists.",
    );
  }

  return {
    envName,
    region,
    stackName,
    userPoolId,
    userStateTableName,
    moderatorGroupName,
    resourceResolutionSource: stack ? "cdk-stack" : "env",
  };
}

async function listUsersByEmail(userPoolId, region, email) {
  const response = await runAws([
    "cognito-idp",
    "list-users",
    "--region",
    region,
    "--user-pool-id",
    userPoolId,
    "--filter",
    `email = "${email}"`,
    "--limit",
    "2",
  ]);

  return Array.isArray(response.Users) ? response.Users : [];
}

async function adminGetUser(userPoolId, region, username) {
  try {
    const response = await runAws([
      "cognito-idp",
      "admin-get-user",
      "--region",
      region,
      "--user-pool-id",
      userPoolId,
      "--username",
      username,
    ]);

    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("UserNotFoundException") ||
        error.message.includes("User does not exist"))
    ) {
      return null;
    }

    throw error;
  }
}

async function resolveSmokeIdentity(config, options) {
  const identifier =
    options.identifier ??
    options.email ??
    process.env.LIGHTNING_SMOKE_IDENTIFIER ??
    "lightning-local-smoke@example.com";

  if (!identifier.includes("@")) {
    throw new Error(
      "Smoke-user bootstrap requires an email identifier. Provide --identifier or LIGHTNING_SMOKE_IDENTIFIER with an email address.",
    );
  }

  const email = identifier.trim().toLowerCase();
  const explicitUsername =
    options.username ?? process.env.LIGHTNING_SMOKE_COGNITO_USERNAME ?? null;
  const desiredUsername = explicitUsername ?? deriveImmutableSmokeUsername(email);
  const desiredName =
    options.name ??
    process.env.LIGHTNING_SMOKE_EXPECTED_USER ??
    "Local Smoke";
  const password =
    options.password ??
    process.env.LIGHTNING_SMOKE_PASSWORD ??
    null;

  if (!password) {
    throw new Error(
      "Provide LIGHTNING_SMOKE_PASSWORD or --password so the smoke user can be created or reset deterministically.",
    );
  }

  if (explicitUsername) {
    const existingByUsername = await adminGetUser(
      config.userPoolId,
      config.region,
      explicitUsername,
    );

    if (existingByUsername) {
      return {
        exists: true,
        username: explicitUsername,
        email: getUserAttribute(existingByUsername, "email") ?? email,
        name: getUserAttribute(existingByUsername, "name") ?? desiredName,
      };
    }
  }

  const usersByEmail = await listUsersByEmail(config.userPoolId, config.region, email);

  if (usersByEmail.length > 0) {
    const exactMatch =
      usersByEmail.find((user) => getUserAttribute(user, "email") === email) ??
      usersByEmail[0];

    return {
      exists: true,
      username: exactMatch.Username,
      email: getUserAttribute(exactMatch, "email") ?? email,
      name: getUserAttribute(exactMatch, "name") ?? desiredName,
    };
  }

  return {
    exists: false,
    username: desiredUsername,
    email,
    name: desiredName,
  };
}

async function createOrUpdateSmokeUser(config, resolvedIdentity, password, desiredName) {
  if (!resolvedIdentity.exists) {
    await run(awsBin, [
      "cognito-idp",
      "admin-create-user",
      "--region",
      config.region,
      "--user-pool-id",
      config.userPoolId,
      "--username",
      resolvedIdentity.username,
      "--temporary-password",
      password,
      "--message-action",
      "SUPPRESS",
      "--user-attributes",
      `Name=email,Value=${resolvedIdentity.email}`,
      "Name=email_verified,Value=true",
      `Name=name,Value=${desiredName}`,
    ]);
  }

  await run(awsBin, [
    "cognito-idp",
    "admin-update-user-attributes",
    "--region",
    config.region,
    "--user-pool-id",
    config.userPoolId,
    "--username",
    resolvedIdentity.username,
    "--user-attributes",
    `Name=email,Value=${resolvedIdentity.email}`,
    "Name=email_verified,Value=true",
    `Name=name,Value=${desiredName}`,
  ]);

  await run(awsBin, [
    "cognito-idp",
    "admin-set-user-password",
    "--region",
    config.region,
    "--user-pool-id",
    config.userPoolId,
    "--username",
    resolvedIdentity.username,
    "--password",
    password,
    "--permanent",
  ]);

  const user = await adminGetUser(
    config.userPoolId,
    config.region,
    resolvedIdentity.username,
  );

  if (!user) {
    throw new Error("Unable to load the smoke user after creation/update.");
  }

  return user;
}

async function ensureNonModerator(config, username) {
  const listResponse = await runAws([
    "cognito-idp",
    "admin-list-groups-for-user",
    "--region",
    config.region,
    "--user-pool-id",
    config.userPoolId,
    "--username",
    username,
  ]);

  const groupsBefore = (listResponse.Groups ?? [])
    .map((group) => group.GroupName)
    .filter((groupName) => typeof groupName === "string" && groupName.trim());
  const wasModerator = groupsBefore.includes(config.moderatorGroupName);

  if (wasModerator) {
    await run(awsBin, [
      "cognito-idp",
      "admin-remove-user-from-group",
      "--region",
      config.region,
      "--user-pool-id",
      config.userPoolId,
      "--username",
      username,
      "--group-name",
      config.moderatorGroupName,
    ]);
  }

  const groupsAfterResponse = await runAws([
    "cognito-idp",
    "admin-list-groups-for-user",
    "--region",
    config.region,
    "--user-pool-id",
    config.userPoolId,
    "--username",
    username,
  ]);

  const groupsAfter = (groupsAfterResponse.Groups ?? [])
    .map((group) => group.GroupName)
    .filter((groupName) => typeof groupName === "string" && groupName.trim());

  return {
    groupsBefore,
    groupsAfter,
    removedModeratorAccess: wasModerator,
  };
}

function getUserPartitionKey(userId) {
  return `USER#${userId}`;
}

function getFavoriteSortKey(bookId) {
  return `FAVORITE#${bookId}`;
}

function getReadingListSortKey(bookId) {
  return `READING_LIST#${bookId}`;
}

async function seedSmokeUserState(config, userId, options) {
  const favoriteBookId =
    options["favorite-book-id"] ??
    process.env.LIGHTNING_SMOKE_FAVORITE_BOOK_ID ??
    "1";
  const readingListBookId =
    options["reading-list-book-id"] ??
    process.env.LIGHTNING_SMOKE_READING_LIST_BOOK_ID ??
    favoriteBookId;
  const readingListType =
    options["reading-list-type"] ??
    process.env.LIGHTNING_SMOKE_READING_LIST_TYPE ??
    "currentlyReading";
  const now = new Date().toISOString();

  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: config.region }),
  );

  await client.send(
    new UpdateCommand({
      TableName: config.userStateTableName,
      Key: {
        pk: getUserPartitionKey(userId),
        sk: getFavoriteSortKey(favoriteBookId),
      },
      UpdateExpression: [
        "SET entityType = :entityType",
        "id = if_not_exists(id, :id)",
        "userId = :userId",
        "bookId = :bookId",
        "createdAt = if_not_exists(createdAt, :createdAt)",
      ].join(", "),
      ExpressionAttributeValues: {
        ":entityType": "favorite",
        ":id": `favorite:${userId}:${favoriteBookId}`,
        ":userId": userId,
        ":bookId": favoriteBookId,
        ":createdAt": now,
      },
    }),
  );

  await client.send(
    new UpdateCommand({
      TableName: config.userStateTableName,
      Key: {
        pk: getUserPartitionKey(userId),
        sk: getReadingListSortKey(readingListBookId),
      },
      UpdateExpression: [
        "SET entityType = :entityType",
        "id = if_not_exists(id, :id)",
        "userId = :userId",
        "bookId = :bookId",
        "listType = :listType",
        "addedAt = if_not_exists(addedAt, :addedAt)",
      ].join(", "),
      ExpressionAttributeValues: {
        ":entityType": "readingList",
        ":id": `reading-list:${userId}:${readingListBookId}`,
        ":userId": userId,
        ":bookId": readingListBookId,
        ":listType": readingListType,
        ":addedAt": now,
      },
    }),
  );

  const [favoriteRecord, readingListRecord] = await Promise.all([
    client.send(
      new GetCommand({
        TableName: config.userStateTableName,
        Key: {
          pk: getUserPartitionKey(userId),
          sk: getFavoriteSortKey(favoriteBookId),
        },
      }),
    ),
    client.send(
      new GetCommand({
        TableName: config.userStateTableName,
        Key: {
          pk: getUserPartitionKey(userId),
          sk: getReadingListSortKey(readingListBookId),
        },
      }),
    ),
  ]);

  return {
    favoriteBookId,
    readingListBookId,
    readingListType,
    favoriteRecord: favoriteRecord.Item ?? null,
    readingListRecord: readingListRecord.Item ?? null,
  };
}

async function main() {
  const { action, options } = parseArgs(process.argv.slice(2));

  if (action !== "ensure") {
    throw new Error(`Unsupported action "${action}". Use ensure.`);
  }

  const config = await resolveRuntimeConfig(options);
  const password =
    options.password ??
    process.env.LIGHTNING_SMOKE_PASSWORD ??
    null;
  const desiredName =
    options.name ??
    process.env.LIGHTNING_SMOKE_EXPECTED_USER ??
    "Local Smoke";
  const resolvedIdentity = await resolveSmokeIdentity(config, options);
  const user = await createOrUpdateSmokeUser(
    config,
    resolvedIdentity,
    password,
    desiredName,
  );
  const username = user.Username;
  const userId = getUserAttribute(user, "sub");

  if (!username || !userId) {
    throw new Error("Unable to resolve the smoke user's Cognito username and sub.");
  }

  const moderatorCleanup = await ensureNonModerator(config, username);
  const seededState = await seedSmokeUserState(config, userId, options);

  console.log(
    JSON.stringify(
      {
        action,
        envName: config.envName,
        region: config.region,
        stackName: config.stackName,
        userPoolId: config.userPoolId,
        userStateTableName: config.userStateTableName,
        moderatorGroupName: config.moderatorGroupName,
        resourceResolutionSource: config.resourceResolutionSource,
        smokeUser: {
          username,
          email: getUserAttribute(user, "email"),
          name: getUserAttribute(user, "name"),
          id: userId,
          status: user.UserStatus ?? null,
          enabled: user.Enabled ?? null,
          emailVerified: getUserAttribute(user, "email_verified"),
        },
        moderatorCleanup,
        seededState,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Smoke user bootstrap failed:", error);
  process.exitCode = 1;
});
