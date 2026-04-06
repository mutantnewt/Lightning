#!/usr/bin/env node

import { defaultRegion, getStackOutputs, repoRoot, sleep } from "./domain-cutover-lib.mjs";
import { execFileSync } from "node:child_process";

const ghCli = process.env.GH_CLI_BIN ?? "/opt/homebrew/bin/gh";
const automationStackName = "LightningGithubAutomationStack";
const defaultRepositoryFullName = "mutantnewt/Lightning";
const roleOutputKey = "GitHubAlertingManageRoleArn";
const roleSecretName = "LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_ALERTING";

function parseArgs(argv) {
  const args = {
    region: defaultRegion,
    repositoryFullName: defaultRepositoryFullName,
    dryRun: false,
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
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  return args;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: {
      ...process.env,
      PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}`,
      ...(options.env ?? {}),
    },
  });
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
  const automationOutputs = getStackOutputs(automationStackName, args.region);
  const roleArn = automationOutputs[roleOutputKey];

  if (!roleArn) {
    throw new Error(
      `${automationStackName} does not expose ${roleOutputKey}. Deploy the automation stack first.`,
    );
  }

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          dryRun: true,
          region: args.region,
          repositoryFullName: args.repositoryFullName,
          secretName: roleSecretName,
          roleArn,
          automationStackName,
        },
        null,
        2,
      ),
    );
    return;
  }

  await setGitHubSecret(args.repositoryFullName, roleSecretName, roleArn);

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        dryRun: false,
        region: args.region,
        repositoryFullName: args.repositoryFullName,
        secretName: roleSecretName,
        roleArn,
        automationStackName,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Alerting GitHub secret sync failed:", error);
  process.exitCode = 1;
});
