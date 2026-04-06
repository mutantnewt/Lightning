#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRegion,
  getStackOutputs,
  repoRoot,
  run,
} from "./domain-cutover-lib.mjs";

const nodeBin = process.env.NODE_BIN ?? process.execPath;
const backendBootstrapScript = path.join(
  repoRoot,
  "backend",
  "scripts",
  "bootstrapSmokeUser.mjs",
);

const environmentConfigs = {
  staging: {
    stackName: "LightningStagingStack",
    defaultIdentifier:
      process.env.LIGHTNING_STAGING_LOCAL_SMOKE_IDENTIFIER ??
      "lightning-staging-local-smoke@example.com",
    defaultDisplayName:
      process.env.LIGHTNING_STAGING_LOCAL_SMOKE_NAME ??
      "Staging Local Smoke",
  },
  production: {
    stackName: "LightningProductionStack",
    defaultIdentifier:
      process.env.LIGHTNING_PRODUCTION_LOCAL_SMOKE_IDENTIFIER ??
      "lightning-production-local-smoke@example.com",
    defaultDisplayName:
      process.env.LIGHTNING_PRODUCTION_LOCAL_SMOKE_NAME ??
      "Production Local Smoke",
  },
};

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

export function requiresSmokeCredentialBootstrap(env = process.env) {
  return !(env.LIGHTNING_SMOKE_IDENTIFIER && env.LIGHTNING_SMOKE_PASSWORD);
}

export function ensureCloudSmokeCredentials(options = {}) {
  const environmentName = options.environmentName ?? "staging";
  const config = environmentConfigs[environmentName];

  if (!config) {
    throw new Error(
      `Unsupported cloud smoke environment: ${environmentName}. Expected staging or production.`,
    );
  }

  const region = options.region ?? defaultRegion;
  const identifier = options.identifier?.trim() || config.defaultIdentifier;
  const displayName = options.displayName?.trim() || config.defaultDisplayName;
  const password = options.password || generateStrongPassword();
  const stackOutputs = getStackOutputs(config.stackName, region);
  const smokeUserResult = runJson(
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
        LIGHTNING_CDK_STACK_NAME: config.stackName,
      },
    },
  );

  return {
    observedAt: new Date().toISOString(),
    environmentName,
    region,
    stackName: config.stackName,
    smokeIdentifier: identifier,
    smokeDisplayName: displayName,
    smokePassword: password,
    generatedPassword: !options.password,
    smokeUser: smokeUserResult?.smokeUser ?? null,
  };
}

function parseArgs(argv) {
  const args = {
    environmentName: "staging",
    region: defaultRegion,
    identifier: "",
    displayName: "",
    password: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environmentName = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
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
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = ensureCloudSmokeCredentials({
    environmentName: args.environmentName,
    region: args.region,
    identifier: args.identifier,
    displayName: args.displayName,
    password: args.password,
  });

  console.log(
    JSON.stringify(
      {
        ...result,
        smokePassword: "<redacted>",
      },
      null,
      2,
    ),
  );
}
