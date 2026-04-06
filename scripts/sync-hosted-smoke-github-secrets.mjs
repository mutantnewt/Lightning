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
const defaultRepositoryFullName = "mutantnewt/Lightning";

const environmentConfigs = {
  staging: {
    stackName: "LightningStagingStack",
    roleOutputKey: "GitHubHostedSmokeRoleArnStaging",
    roleSecretName: "LIGHTNING_GITHUB_ACTIONS_ROLE_ARN",
    identifierSecretName: "LIGHTNING_STAGING_SMOKE_IDENTIFIER",
    passwordSecretName: "LIGHTNING_STAGING_SMOKE_PASSWORD",
    defaultSmokeIdentifier: "lightning-staging-smoke@example.com",
    defaultSmokeDisplayName: "Staging Smoke",
    workflowName: "Hosted Staging Smoke",
  },
  production: {
    stackName: "LightningProductionStack",
    roleOutputKey: "GitHubHostedSmokeRoleArnProduction",
    roleSecretName: "LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_PRODUCTION",
    identifierSecretName: "LIGHTNING_PRODUCTION_SMOKE_IDENTIFIER",
    passwordSecretName: "LIGHTNING_PRODUCTION_SMOKE_PASSWORD",
    defaultSmokeIdentifier: "lightning-production-smoke@example.com",
    defaultSmokeDisplayName: "Production Smoke",
    workflowName: "Hosted Production Smoke",
  },
};

function parseArgs(argv, environmentName) {
  const config = environmentConfigs[environmentName];

  if (!config) {
    throw new Error(`Unsupported smoke environment: ${environmentName}`);
  }

  const args = {
    region: defaultRegion,
    repositoryFullName: defaultRepositoryFullName,
    identifier: config.defaultSmokeIdentifier,
    displayName: config.defaultSmokeDisplayName,
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
  environmentName,
  identifier,
  displayName,
  password,
  stackOutputs,
  stackName,
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
      stackOutputs.UserPoolId,
      "--user-state-table",
      stackOutputs.UserStateTableName,
      "--group-name",
      stackOutputs.CatalogModeratorGroupName,
    ],
    {
      cwd: repoRoot,
      env: {
        AWS_REGION: region,
        AWS_DEFAULT_REGION: region,
        LIGHTNING_ENV: environmentName,
        APP_ENV: environmentName,
        LIGHTNING_CDK_STACK_NAME: stackName,
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

export async function runHostedSmokeSecretSync(
  environmentName,
  argv = process.argv.slice(2),
) {
  const config = environmentConfigs[environmentName];

  if (!config) {
    throw new Error(`Unsupported smoke environment: ${environmentName}`);
  }

  const args = parseArgs(argv, environmentName);
  const password = args.password || generateStrongPassword();
  const automationOutputs = getStackOutputs(automationStackName, args.region);
  const stackOutputs = getStackOutputs(config.stackName, args.region);
  const secretPayload = {
    [config.roleSecretName]: automationOutputs[config.roleOutputKey],
    [config.identifierSecretName]: args.identifier,
    [config.passwordSecretName]: password,
  };

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          dryRun: true,
          environmentName,
          region: args.region,
          repositoryFullName: args.repositoryFullName,
          automationStackName,
          stackName: config.stackName,
          roleArn: secretPayload[config.roleSecretName],
          roleSecretName: config.roleSecretName,
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
        environmentName,
        identifier: args.identifier,
        displayName: args.displayName,
        password,
        stackOutputs,
        stackName: config.stackName,
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
        environmentName,
        region: args.region,
        repositoryFullName: args.repositoryFullName,
        automationStackName,
        stackName: config.stackName,
        roleArn: secretPayload[config.roleSecretName],
        roleSecretName: config.roleSecretName,
        smokeIdentifier: args.identifier,
        smokeDisplayName: args.displayName,
        generatedPassword: !args.password,
        githubSecretsWritten: !args.skipGitHubSecrets,
        smokeUserBootstrapped: !args.skipBootstrapUser,
        smokeUser: smokeUserResult?.smokeUser ?? null,
        nextStep: `Run the ${config.workflowName} workflow in GitHub Actions to validate the new secret set.`,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.error(
    "Use one of the environment-specific wrappers instead of invoking sync-hosted-smoke-github-secrets.mjs directly.",
  );
  process.exitCode = 1;
}
