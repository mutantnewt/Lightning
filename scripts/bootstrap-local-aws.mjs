import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const backendDir = join(repoRoot, "backend");
const frontendDir = join(repoRoot, "literary-light");

const awsBin = process.env.AWS_BIN ?? "/opt/homebrew/bin/aws";
const npmBin = process.env.NPM_BIN ?? "/usr/local/bin/npm";
const nodeBin = process.env.NODE_BIN ?? process.execPath;
const runtimePath = [
  dirname(nodeBin),
  dirname(npmBin),
  dirname(awsBin),
  "/usr/local/bin",
  "/opt/homebrew/bin",
  process.env.PATH ?? "",
]
  .filter(Boolean)
  .join(":");

const envName = process.env.LIGHTNING_ENV ?? "local";
const region = process.env.AWS_REGION ?? "eu-west-2";
const frontendOrigin = process.env.LIGHTNING_FRONTEND_ORIGIN ?? "http://127.0.0.1:5175";
const siteUrl = process.env.LIGHTNING_SITE_URL ?? frontendOrigin;
const apiBaseUrl = process.env.LIGHTNING_API_BASE_URL ?? "http://127.0.0.1:8787";
const frontendApiMode = process.env.LIGHTNING_FRONTEND_API_MODE ?? "local-backend";
const stackName = process.env.LIGHTNING_CDK_STACK_NAME ?? "LightningLocalStack";

const expectedUserPoolName = `lightning-users-${envName}`;
const expectedUserPoolClientName = `lightning-web-${envName}`;
const expectedCatalogModeratorGroupName = `lightning-catalog-moderators-${envName}`;
const expectedBooksTableName = `lightning-books-${envName}`;
const expectedUserStateTableName = `lightning-user-state-${envName}`;
const expectedBookSuggestionsTableName = `lightning-book-suggestions-${envName}`;

const shouldCreateMissing = process.argv.includes("--create-missing");
const shouldSkipSeed = process.argv.includes("--skip-seed");
const shouldRequireCdk = process.argv.includes("--require-cdk");
const shouldIgnoreCdk = process.argv.includes("--ignore-cdk");
const shouldEnsureSmokeUser = process.argv.includes("--ensure-smoke-user");

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

function writeFile(path, content) {
  writeFileSync(path, `${content.trim()}\n`, "utf8");
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

async function describeStack(targetStackName) {
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
    if (
      error instanceof Error &&
      error.message.includes("does not exist")
    ) {
      return null;
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

function resolveResourcesFromStackOutputs(outputMap) {
  const userPoolId = outputMap.UserPoolId;
  const userPoolClientId = outputMap.UserPoolClientId;
  const userPoolName = outputMap.UserPoolName ?? expectedUserPoolName;
  const userPoolClientName =
    outputMap.UserPoolClientName ?? expectedUserPoolClientName;
  const catalogModeratorGroupName =
    outputMap.CatalogModeratorGroupName ?? expectedCatalogModeratorGroupName;
  const booksTableName = outputMap.BooksTableName ?? expectedBooksTableName;
  const userStateTableName =
    outputMap.UserStateTableName ?? expectedUserStateTableName;
  const bookSuggestionsTableName =
    outputMap.BookSuggestionsTableName ?? expectedBookSuggestionsTableName;
  const httpApiUrl = outputMap.HttpApiUrl ?? null;
  const publicApiBaseUrl =
    outputMap.PublicApiBaseUrl ?? httpApiUrl ?? null;
  const authApiBaseUrl =
    outputMap.AuthApiBaseUrl ?? httpApiUrl ?? null;
  const privilegedApiBaseUrl =
    outputMap.PrivilegedApiBaseUrl ?? httpApiUrl ?? null;
  const resolvedSiteUrl = outputMap.SiteUrl ?? siteUrl;

  if (!userPoolId || !userPoolClientId) {
    throw new Error(
      `CloudFormation stack ${stackName} is missing required Cognito outputs.`,
    );
  }

  return {
    stackName,
    userPoolName,
    userPoolId,
    userPoolClientName,
    userPoolClientId,
    catalogModeratorGroupName,
    booksTableName,
    userStateTableName,
    bookSuggestionsTableName,
    publicApiBaseUrl,
    authApiBaseUrl,
    privilegedApiBaseUrl,
    siteUrl: resolvedSiteUrl,
    resourceResolutionSource: "cdk-stack",
  };
}

async function ensureUserPool() {
  const existingId = await findUserPoolIdByName(expectedUserPoolName);

  if (existingId) {
    return existingId;
  }

  if (!shouldCreateMissing) {
    throw new Error(
      `Missing Cognito user pool ${expectedUserPoolName}. Re-run with --create-missing to create it.`,
    );
  }

  const created = await runAws([
    "cognito-idp",
    "create-user-pool",
    "--region",
    region,
    "--pool-name",
    expectedUserPoolName,
    "--policies",
    JSON.stringify({
      PasswordPolicy: {
        MinimumLength: 8,
        RequireUppercase: true,
        RequireLowercase: true,
        RequireNumbers: true,
        RequireSymbols: true,
        TemporaryPasswordValidityDays: 7,
      },
    }),
    "--auto-verified-attributes",
    "email",
    "--alias-attributes",
    "email",
    "--username-configuration",
    "CaseSensitive=false",
    "--verification-message-template",
    JSON.stringify({
      DefaultEmailOption: "CONFIRM_WITH_CODE",
      EmailSubject: "Your Lightning Classics verification code",
      EmailMessage: "Your Lightning Classics verification code is {####}",
    }),
    "--admin-create-user-config",
    JSON.stringify({
      AllowAdminCreateUserOnly: false,
    }),
    "--account-recovery-setting",
    JSON.stringify({
      RecoveryMechanisms: [
        {
          Priority: 1,
          Name: "verified_email",
        },
      ],
    }),
  ]);

  return created.UserPool.Id;
}

async function findUserPoolClientId(userPoolId) {
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
    (client) => client.ClientName === expectedUserPoolClientName,
  );

  return match?.ClientId ?? null;
}

async function ensureUserPoolClient(userPoolId) {
  const existingId = await findUserPoolClientId(userPoolId);

  if (existingId) {
    return existingId;
  }

  if (!shouldCreateMissing) {
    throw new Error(
      `Missing Cognito app client ${expectedUserPoolClientName}. Re-run with --create-missing to create it.`,
    );
  }

  const created = await runAws([
    "cognito-idp",
    "create-user-pool-client",
    "--region",
    region,
    "--user-pool-id",
    userPoolId,
    "--client-name",
    expectedUserPoolClientName,
    "--no-generate-secret",
    "--explicit-auth-flows",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "--supported-identity-providers",
    "COGNITO",
    "--prevent-user-existence-errors",
    "ENABLED",
    "--enable-token-revocation",
    "--refresh-token-validity",
    "1",
    "--access-token-validity",
    "60",
    "--id-token-validity",
    "60",
    "--token-validity-units",
    "AccessToken=minutes,IdToken=minutes,RefreshToken=days",
  ]);

  return created.UserPoolClient.ClientId;
}

async function ensureUserPoolGroup(userPoolId) {
  try {
    const response = await runAws([
      "cognito-idp",
      "get-group",
      "--region",
      region,
      "--user-pool-id",
      userPoolId,
      "--group-name",
      expectedCatalogModeratorGroupName,
    ]);

    return response.Group?.GroupName ?? expectedCatalogModeratorGroupName;
  } catch {
    if (!shouldCreateMissing) {
      throw new Error(
        `Missing Cognito user-pool group ${expectedCatalogModeratorGroupName}. Re-run with --create-missing to create it.`,
      );
    }

    await runAws([
      "cognito-idp",
      "create-group",
      "--region",
      region,
      "--user-pool-id",
      userPoolId,
      "--group-name",
      expectedCatalogModeratorGroupName,
      "--description",
      "Lightning Classics catalog moderators",
      "--precedence",
      "1",
    ]);

    return expectedCatalogModeratorGroupName;
  }
}

async function tableExists(tableName) {
  try {
    await runAws([
      "dynamodb",
      "describe-table",
      "--region",
      region,
      "--table-name",
      tableName,
    ]);

    return true;
  } catch {
    return false;
  }
}

async function ensureTable(tableName) {
  if (await tableExists(tableName)) {
    return tableName;
  }

  if (!shouldCreateMissing) {
    throw new Error(
      `Missing DynamoDB table ${tableName}. Re-run with --create-missing to create it.`,
    );
  }

  await run(awsBin, [
    "dynamodb",
    "create-table",
    "--region",
    region,
    "--table-name",
    tableName,
    "--attribute-definitions",
    "AttributeName=pk,AttributeType=S",
    "AttributeName=sk,AttributeType=S",
    "--key-schema",
    "AttributeName=pk,KeyType=HASH",
    "AttributeName=sk,KeyType=RANGE",
    "--billing-mode",
    "PAY_PER_REQUEST",
  ]);

  await run(awsBin, [
    "dynamodb",
    "wait",
    "table-exists",
    "--region",
    region,
    "--table-name",
    tableName,
  ]);

  return tableName;
}

function writeBackendEnvLocal({
  userPoolId,
  userPoolClientId,
  catalogModeratorGroupName,
  booksTableName,
  userStateTableName,
  bookSuggestionsTableName,
}) {
  writeFile(
    join(backendDir, ".env.local"),
    `
APP_ENV=${envName}
AWS_REGION=${region}
BOOKS_TABLE_NAME=${booksTableName}
USER_STATE_TABLE_NAME=${userStateTableName}
BOOK_SUGGESTIONS_TABLE_NAME=${bookSuggestionsTableName}
COGNITO_USER_POOL_ID=${userPoolId}
COGNITO_APP_CLIENT_ID=${userPoolClientId}
CATALOG_MODERATOR_GROUP_NAME=${catalogModeratorGroupName}
CORS_ALLOW_ORIGIN=${frontendOrigin}
ALLOW_LOCAL_AUTH_HEADERS=true
LOG_LEVEL=info
    `,
  );
}

function resolveFrontendApiUrls(resolvedResources) {
  if (frontendApiMode === "deployed-api") {
    const publicApiBaseUrl = resolvedResources.publicApiBaseUrl;
    const authApiBaseUrl = resolvedResources.authApiBaseUrl;
    const privilegedApiBaseUrl = resolvedResources.privilegedApiBaseUrl;

    if (!publicApiBaseUrl || !authApiBaseUrl || !privilegedApiBaseUrl) {
      throw new Error(
        "Deployed frontend API mode requires CloudFormation outputs for public, auth, and privileged API base URLs.",
      );
    }

    return {
      publicApiBaseUrl,
      authApiBaseUrl,
      privilegedApiBaseUrl,
    };
  }

  return {
    publicApiBaseUrl: apiBaseUrl,
    authApiBaseUrl: apiBaseUrl,
    privilegedApiBaseUrl: apiBaseUrl,
  };
}

function writeFrontendEnvLocal({
  userPoolId,
  userPoolClientId,
  catalogModeratorGroupName,
  publicApiBaseUrl,
  authApiBaseUrl,
  privilegedApiBaseUrl,
  siteUrl: resolvedSiteUrl,
}) {
  writeFile(
    join(frontendDir, ".env.local"),
    `
VITE_APP_ENV=${envName}
VITE_AWS_REGION=${region}
VITE_COGNITO_USER_POOL_ID=${userPoolId}
VITE_COGNITO_USER_POOL_CLIENT_ID=${userPoolClientId}
VITE_CATALOG_MODERATOR_GROUP_NAME=${catalogModeratorGroupName}
VITE_API_PUBLIC_BASE_URL=${publicApiBaseUrl}
VITE_API_AUTH_BASE_URL=${authApiBaseUrl}
VITE_API_PRIVILEGED_BASE_URL=${privilegedApiBaseUrl}
VITE_SITE_URL=${resolvedSiteUrl}
    `,
  );
}

async function seedCatalog() {
  await run(npmBin, ["run", "seed:catalog"], {
    cwd: backendDir,
  });
}

async function ensureSmokeUser() {
  const result = await run(
    nodeBin,
    [join(repoRoot, "scripts", "bootstrap-local-smoke-user.mjs")],
    {
      cwd: repoRoot,
    },
  );

  return result.stdout ? JSON.parse(result.stdout) : null;
}

async function main() {
  let resolvedResources = null;

  if (!shouldIgnoreCdk) {
    const stack = await describeStack(stackName);

    if (stack) {
      resolvedResources = resolveResourcesFromStackOutputs(
        outputsToMap(stack.Outputs),
      );
    }
  }

  if (!resolvedResources) {
    if (shouldRequireCdk) {
      throw new Error(
        `CloudFormation stack ${stackName} was not found. Deploy it first or rerun without --require-cdk.`,
      );
    }

    const userPoolId = await ensureUserPool();
    const userPoolClientId = await ensureUserPoolClient(userPoolId);
    const catalogModeratorGroupName = await ensureUserPoolGroup(userPoolId);

    await ensureTable(expectedBooksTableName);
    await ensureTable(expectedUserStateTableName);
    await ensureTable(expectedBookSuggestionsTableName);

    resolvedResources = {
      stackName: null,
      userPoolName: expectedUserPoolName,
      userPoolId,
      userPoolClientName: expectedUserPoolClientName,
      userPoolClientId,
      catalogModeratorGroupName,
      booksTableName: expectedBooksTableName,
      userStateTableName: expectedUserStateTableName,
      bookSuggestionsTableName: expectedBookSuggestionsTableName,
      publicApiBaseUrl: null,
      authApiBaseUrl: null,
      privilegedApiBaseUrl: null,
      siteUrl,
      resourceResolutionSource: "direct-aws",
    };
  }

  const frontendApiUrls = resolveFrontendApiUrls(resolvedResources);

  writeBackendEnvLocal({
    userPoolId: resolvedResources.userPoolId,
    userPoolClientId: resolvedResources.userPoolClientId,
    catalogModeratorGroupName: resolvedResources.catalogModeratorGroupName,
    booksTableName: resolvedResources.booksTableName,
    userStateTableName: resolvedResources.userStateTableName,
    bookSuggestionsTableName: resolvedResources.bookSuggestionsTableName,
  });
  writeFrontendEnvLocal({
    userPoolId: resolvedResources.userPoolId,
    userPoolClientId: resolvedResources.userPoolClientId,
    catalogModeratorGroupName: resolvedResources.catalogModeratorGroupName,
    publicApiBaseUrl: frontendApiUrls.publicApiBaseUrl,
    authApiBaseUrl: frontendApiUrls.authApiBaseUrl,
    privilegedApiBaseUrl: frontendApiUrls.privilegedApiBaseUrl,
    siteUrl: resolvedResources.siteUrl,
  });

  if (!shouldSkipSeed) {
    await seedCatalog();
  }

  const smokeUserBootstrap = shouldEnsureSmokeUser
    ? await ensureSmokeUser()
    : null;

  console.log(
    JSON.stringify(
      {
        envName,
        region,
        frontendOrigin,
        siteUrl: resolvedResources.siteUrl,
        apiBaseUrl,
        frontendApiMode,
        stackName: resolvedResources.stackName,
        userPoolName: resolvedResources.userPoolName,
        userPoolId: resolvedResources.userPoolId,
        userPoolClientName: resolvedResources.userPoolClientName,
        userPoolClientId: resolvedResources.userPoolClientId,
        catalogModeratorGroupName: resolvedResources.catalogModeratorGroupName,
        booksTableName: resolvedResources.booksTableName,
        userStateTableName: resolvedResources.userStateTableName,
        bookSuggestionsTableName: resolvedResources.bookSuggestionsTableName,
        publicApiBaseUrl: frontendApiUrls.publicApiBaseUrl,
        authApiBaseUrl: frontendApiUrls.authApiBaseUrl,
        privilegedApiBaseUrl: frontendApiUrls.privilegedApiBaseUrl,
        resourceResolutionSource: resolvedResources.resourceResolutionSource,
        createdMissingResources: shouldCreateMissing,
        catalogSeeded: !shouldSkipSeed,
        smokeUserBootstrapped: shouldEnsureSmokeUser,
        smokeUserBootstrap,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Local AWS bootstrap failed:", error);
  process.exitCode = 1;
});
