#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import path from "node:path";
import {
  defaultRegion,
  repoRoot,
  run,
  sleep,
} from "./domain-cutover-lib.mjs";

const ghCli = process.env.GH_CLI_BIN ?? "/opt/homebrew/bin/gh";
const nodeBin = process.env.NODE_BIN ?? process.execPath;
const backendBootstrapScript = path.join(
  repoRoot,
  "backend",
  "scripts",
  "bootstrapSmokeUser.mjs",
);
const automationStackName = "LightningGithubAutomationStack";
const stagingStackName = "LightningStagingStack";
const defaultRepositoryFullName = "mutantnewt/Lightning";
const defaultSmokeIdentifier = "lightning-staging-smoke@example.com";
const defaultSmokeDisplayName = "Staging Smoke";

function parseArgs(argv) {
  const args = {
    region: defaultRegion,
    repositoryFullName: defaultRepositoryFullName,
    identifier: defaultSmokeIdentifier,
    displayName: defaultSmokeDisplayName,
    password: "",
    dryRun: false,
    skipBootstrapUser: false,
    skipGitHubSecrets: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--repo":
        args.repositoryFullName = next;
        index += 1;
        break;
      case "--identifier":
        args.identifier = next;
        index += 1;
        break;
      case "--name":
        args.displayName = next;
        index += 1;
        break;
      case "--password":
        args.password = next;
        index += 1;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--skip-bootstrap-user":
        args.skipBootstrapUser = true;
        break;
      case "--skip-github-secrets":
        args.skipGitHubSecrets = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  return args;
}

function getStackOutputs(stackName, region) {
  const raw = run("aws", [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stackName,
    "--region",
    region,
  ]);
  const parsed = JSON.parse(raw);

  return Object.fromEntries(
    (parsed.Stacks?.[0]?.Outputs ?? []).map((output) => [
      output.OutputKey,
      output.OutputValue,
    ]),
  );
}

function generateStrongPassword(length = 24) {
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+";
  const allCharacters = `${lowercase}${uppercase}${digits}${symbols}`;
  const requiredCharacters = [
    lowercase[randomBytes(1)[0] % lowercase.length],
    uppercase[randomBytes(1)[0] % uppercase.length],
    digits[randomBytes(1)[0] % digits.length],
    symbols[randomBytes(1)[0] % symbols.length],
  ];

  while (requiredCharacters.length < length) {
    requiredCharacters.push(
      allCharacters[randomBytes(1)[0] % allCharacters.length],
    );
  }

  for (let index = requiredCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBytes(1)[0] % (index + 1);
    [requiredCharacters[index], requiredCharacters[swapIndex]] = [
      requiredCharacters[swapIndex],
      requiredCharacters[index],
    ];
  }

  return requiredCharacters.join("");
}

function runJson(command, args, options = {}) {
  const raw = run(command, args, options);
  return raw ? JSON.parse(raw) : null;
}

function bootstrapSmokeUser({
  region,
  identifier,
  displayName,
  password,
  stagingOutputs,
}) {
  return runJson(
    nodeBin,
    [
      backendBootstrapScript,
      "ensure",
      "--identifier",
      identifier,
      "--name",
      displayName,
      "--password",
      password,
      "--user-pool-id",
      stagingOutputs.UserPoolId,
      "--user-state-table",
      stagingOutputs.UserStateTableName,
      "--group-name",
      stagingOutputs.CatalogModeratorGroupName,
    ],
    {
      cwd: repoRoot,
      env: {
        AWS_REGION: region,
        AWS_DEFAULT_REGION: region,
        LIGHTNING_ENV: "staging",
        APP_ENV: "staging",
        LIGHTNING_CDK_STACK_NAME: stagingStackName,
      },
    },
  );
}

async function setGitHubSecret(repositoryFullName, name, value) {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      run(
        ghCli,
        ["secret", "set", name, "--repo", repositoryFullName, "--body", value],
        {
          cwd: repoRoot,
          stdio: "pipe",
        },
      );
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      const isRetryable =
        /HTTP (429|5\d\d)/u.test(message) ||
        /service unavailable|timeout|temporar/u.test(message);

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = 1_000 * 2 ** (attempt - 1);
      console.warn(
        `Retrying GitHub secret sync for ${name} after transient failure (attempt ${attempt}/${maxAttempts}): ${message}`,
      );
      await sleep(delayMs);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = args.password || generateStrongPassword();
  const automationOutputs = getStackOutputs(automationStackName, args.region);
  const stagingOutputs = getStackOutputs(stagingStackName, args.region);
  const secretPayload = {
    LIGHTNING_GITHUB_ACTIONS_ROLE_ARN:
      automationOutputs.GitHubHostedSmokeRoleArnStaging,
    LIGHTNING_STAGING_SMOKE_IDENTIFIER: args.identifier,
    LIGHTNING_STAGING_SMOKE_PASSWORD: password,
  };

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          dryRun: true,
          region: args.region,
          repositoryFullName: args.repositoryFullName,
          automationStackName,
          stagingStackName,
          roleArn: secretPayload.LIGHTNING_GITHUB_ACTIONS_ROLE_ARN,
          smokeIdentifier: args.identifier,
          smokeDisplayName: args.displayName,
          generatedPassword: !args.password,
          actions: {
            bootstrapSmokeUser: !args.skipBootstrapUser,
            writeGitHubSecrets: !args.skipGitHubSecrets,
          },
          secretNames: Object.keys(secretPayload),
        },
        null,
        2,
      ),
    );
    return;
  }

  const smokeUserResult = args.skipBootstrapUser
    ? null
    : bootstrapSmokeUser({
        region: args.region,
        identifier: args.identifier,
        displayName: args.displayName,
        password,
        stagingOutputs,
      });

  if (!args.skipGitHubSecrets) {
    for (const [name, value] of Object.entries(secretPayload)) {
      await setGitHubSecret(args.repositoryFullName, name, value);
    }
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        dryRun: false,
        region: args.region,
        repositoryFullName: args.repositoryFullName,
        automationStackName,
        stagingStackName,
        roleArn: secretPayload.LIGHTNING_GITHUB_ACTIONS_ROLE_ARN,
        smokeIdentifier: args.identifier,
        smokeDisplayName: args.displayName,
        generatedPassword: !args.password,
        githubSecretsWritten: !args.skipGitHubSecrets,
        smokeUserBootstrapped: !args.skipBootstrapUser,
        smokeUser: smokeUserResult?.smokeUser ?? null,
        nextStep:
          "Run the Hosted Staging Smoke workflow in GitHub Actions to validate the new secret set.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Syncing hosted staging smoke GitHub secrets failed:", error);
  process.exitCode = 1;
});
