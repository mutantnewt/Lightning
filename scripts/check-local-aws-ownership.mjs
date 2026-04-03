import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const awsBin = process.env.AWS_BIN ?? "/opt/homebrew/bin/aws";
const runtimePath = [
  dirname(awsBin),
  "/usr/local/bin",
  "/opt/homebrew/bin",
  process.env.PATH ?? "",
]
  .filter(Boolean)
  .join(":");

const envName = process.env.LIGHTNING_ENV ?? "local";
const region = process.env.AWS_REGION ?? "eu-west-2";
const stackName = process.env.LIGHTNING_CDK_STACK_NAME ?? "LightningLocalStack";

const expected = {
  userPoolName: `lightning-users-${envName}`,
  userPoolClientName: `lightning-web-${envName}`,
  booksTableName: `lightning-books-${envName}`,
  userStateTableName: `lightning-user-state-${envName}`,
  bookSuggestionsTableName: `lightning-book-suggestions-${envName}`,
};

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

async function maybeDescribeStack(targetStackName) {
  try {
    const response = await runAws([
      "cloudformation",
      "describe-stacks",
      "--region",
      region,
      "--stack-name",
      targetStackName,
    ]);

    return response.Stacks?.[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      return null;
    }

    throw error;
  }
}

async function maybeListStackResources(targetStackName) {
  try {
    const response = await runAws([
      "cloudformation",
      "list-stack-resources",
      "--region",
      region,
      "--stack-name",
      targetStackName,
    ]);

    return response.StackResourceSummaries ?? [];
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      return [];
    }

    throw error;
  }
}

function outputsToMap(outputs) {
  return Object.fromEntries(
    (outputs ?? [])
      .filter((entry) => entry.OutputKey && entry.OutputValue)
      .map((entry) => [entry.OutputKey, entry.OutputValue]),
  );
}

async function findUserPoolIdByName(targetName) {
  const response = await runAws([
    "cognito-idp",
    "list-user-pools",
    "--max-results",
    "60",
    "--region",
    region,
  ]);

  const match = (response.UserPools ?? []).find((pool) => pool.Name === targetName);
  return match?.Id ?? null;
}

async function findUserPoolClientId(userPoolId, clientName) {
  if (!userPoolId) {
    return null;
  }

  const response = await runAws([
    "cognito-idp",
    "list-user-pool-clients",
    "--region",
    region,
    "--user-pool-id",
    userPoolId,
    "--max-results",
    "60",
  ]);

  const match = (response.UserPoolClients ?? []).find(
    (client) => client.ClientName === clientName,
  );

  return match?.ClientId ?? null;
}

async function maybeDescribeTable(tableName) {
  try {
    const response = await runAws([
      "dynamodb",
      "describe-table",
      "--region",
      region,
      "--table-name",
      tableName,
    ]);

    return response.Table ?? null;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("ResourceNotFoundException") ||
        error.message.includes("Requested resource not found"))
    ) {
      return null;
    }

    throw error;
  }
}

function toStackResourceMap(stackResources) {
  const byLogicalId = {};
  const byType = {};

  for (const resource of stackResources ?? []) {
    const normalized = {
      logicalId: resource.LogicalResourceId ?? null,
      type: resource.ResourceType ?? null,
      physicalId: resource.PhysicalResourceId ?? null,
      status: resource.ResourceStatus ?? null,
    };

    if (resource.LogicalResourceId) {
      byLogicalId[resource.LogicalResourceId] = normalized;
    }

    if (resource.ResourceType) {
      byType[resource.ResourceType] ??= [];
      byType[resource.ResourceType].push(normalized);
    }
  }

  return {
    byLogicalId,
    byType,
  };
}

function getOwnershipStatus({ stackExists, resourcesFound, matches }) {
  const anyResourcesFound = Object.values(resourcesFound).some(Boolean);
  const allMatches = Object.values(matches).every(Boolean);

  if (stackExists && allMatches) {
    return "stack-managed";
  }

  if (!stackExists && anyResourcesFound) {
    return "manual-resources-detected";
  }

  if (stackExists && anyResourcesFound) {
    return "split-ownership-or-drift";
  }

  if (!stackExists && !anyResourcesFound) {
    return "no-resources-found";
  }

  return "unknown";
}

function getRecommendedAction(ownershipStatus) {
  switch (ownershipStatus) {
    case "stack-managed":
      return "use-cdk-as-system-of-record";
    case "manual-resources-detected":
      return "clean-recreate-under-cdk-recommended";
    case "split-ownership-or-drift":
      return "investigate-before-cutover";
    case "no-resources-found":
      return "deploy-local-stack-via-cdk";
    default:
      return "manual-review-required";
  }
}

function getNextCommands(ownershipStatus) {
  switch (ownershipStatus) {
    case "stack-managed":
      return [
        "env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 /usr/local/bin/node scripts/bootstrap-local-aws.mjs --require-cdk",
        "env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... /usr/local/bin/node scripts/local-frontend-smoke.mjs",
      ];
    case "manual-resources-detected":
      return [
        "/usr/local/bin/node scripts/export-local-dynamo-backup.mjs",
        "cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run deploy:local",
      ];
    case "split-ownership-or-drift":
      return [
        "/usr/local/bin/node scripts/check-local-aws-ownership.mjs",
        "cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run synth",
      ];
    case "no-resources-found":
      return [
        "cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run deploy:local",
        "env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 /usr/local/bin/node scripts/bootstrap-local-aws.mjs --require-cdk",
      ];
    default:
      return [];
  }
}

async function main() {
  const [stack, stackResources, userPoolId, booksTable, userStateTable, bookSuggestionsTable] =
    await Promise.all([
      maybeDescribeStack(stackName),
      maybeListStackResources(stackName),
      findUserPoolIdByName(expected.userPoolName),
      maybeDescribeTable(expected.booksTableName),
      maybeDescribeTable(expected.userStateTableName),
      maybeDescribeTable(expected.bookSuggestionsTableName),
    ]);

  const userPoolClientId = await findUserPoolClientId(
    userPoolId,
    expected.userPoolClientName,
  );

  const stackOutputs = outputsToMap(stack?.Outputs);
  const stackResourceMap = toStackResourceMap(stackResources);

  const resourcesFound = {
    userPool: Boolean(userPoolId),
    userPoolClient: Boolean(userPoolClientId),
    booksTable: Boolean(booksTable),
    userStateTable: Boolean(userStateTable),
    bookSuggestionsTable: Boolean(bookSuggestionsTable),
  };

  const matches = {
    userPool:
      Boolean(userPoolId) &&
      stackOutputs.UserPoolId === userPoolId,
    userPoolClient:
      Boolean(userPoolClientId) &&
      stackOutputs.UserPoolClientId === userPoolClientId,
    booksTable:
      Boolean(booksTable) &&
      stackOutputs.BooksTableName === booksTable.TableName,
    userStateTable:
      Boolean(userStateTable) &&
      stackOutputs.UserStateTableName === userStateTable.TableName,
    bookSuggestionsTable:
      Boolean(bookSuggestionsTable) &&
      stackOutputs.BookSuggestionsTableName ===
        bookSuggestionsTable.TableName,
  };

  const ownershipStatus = getOwnershipStatus({
    stackExists: Boolean(stack),
    resourcesFound,
    matches,
  });

  console.log(
    JSON.stringify(
      {
        envName,
        region,
        stackName,
        ownershipStatus,
        recommendedAction: getRecommendedAction(ownershipStatus),
        expected,
        current: {
          userPoolId,
          userPoolClientId,
          booksTableName: booksTable?.TableName ?? null,
          userStateTableName: userStateTable?.TableName ?? null,
          bookSuggestionsTableName: bookSuggestionsTable?.TableName ?? null,
        },
        stack: stack
          ? {
              status: stack.StackStatus ?? null,
              outputs: stackOutputs,
              resources: stackResourceMap.byLogicalId,
            }
          : null,
        resourcesFound,
        matches,
        nextCommands: getNextCommands(ownershipStatus),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Local AWS ownership check failed:", error);
  process.exitCode = 1;
});
