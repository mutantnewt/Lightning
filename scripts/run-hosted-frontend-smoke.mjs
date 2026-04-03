#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import {
  buildHostedFrontendUrlFromOutputs,
  defaultRegion,
  getAmplifyDomainAssociation,
  getHostedFrontendTargets,
  getStackOutputs,
  lightningRootDomainName,
  repoRoot,
} from "./domain-cutover-lib.mjs";

const nodeBin = process.env.NODE_BIN ?? process.execPath;
const smokeScript = path.join(repoRoot, "scripts", "local-frontend-smoke.mjs");

function parseArgs(argv) {
  const args = {
    environmentName: "staging",
    targetMode: "auto",
    explicitUrl: process.env.LIGHTNING_HOSTED_SMOKE_URL ?? "",
    region: defaultRegion,
    domainName: lightningRootDomainName,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environmentName = next;
        index += 1;
        break;
      case "--target":
        args.targetMode = next;
        index += 1;
        break;
      case "--url":
        args.explicitUrl = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--domain":
        args.domainName = next;
        index += 1;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["staging", "production"].includes(args.environmentName)) {
    throw new Error("--environment must be either staging or production.");
  }

  if (!["auto", "default-amplify", "custom-domain", "url"].includes(args.targetMode)) {
    throw new Error(
      "--target must be one of: auto, default-amplify, custom-domain, url.",
    );
  }

  if (args.targetMode === "url" && !args.explicitUrl) {
    throw new Error("--target url requires --url or LIGHTNING_HOSTED_SMOKE_URL.");
  }

  return args;
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;

      if (options.echoStdout) {
        process.stdout.write(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;

      if (options.echoStderr) {
        process.stderr.write(text);
      }
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
            `Command failed: ${command} ${commandArgs.join(" ")}`,
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

function getCustomDomainState(target, domainAssociation) {
  const matchingSubDomain =
    domainAssociation?.subDomains?.find(
      (entry) =>
        (entry.subDomainSetting?.prefix ?? "") === target.subdomainPrefix,
    ) ?? null;
  const isApexTarget = target.subdomainPrefix === "";
  const domainStatus = domainAssociation?.domainStatus ?? null;
  const verified = matchingSubDomain?.verified ?? false;
  const verificationSatisfied = verified || (isApexTarget && domainStatus === "AVAILABLE");

  return {
    domainStatus,
    updateStatus: domainAssociation?.updateStatus ?? null,
    verified,
    isApexTarget,
    verificationSatisfied,
  };
}

function resolveTargetUrl(args) {
  if (args.targetMode === "url") {
    return {
      smokeUrl: args.explicitUrl,
      selectedTarget: "url",
      fallbackReason: null,
      stackOutputs: null,
      customDomainState: null,
    };
  }

  const target = getHostedFrontendTargets(args.domainName)[args.environmentName];
  const stackOutputs = getStackOutputs(target.stackName, args.region);
  const amplifyUrl = buildHostedFrontendUrlFromOutputs(stackOutputs);

  let domainAssociation = null;

  try {
    domainAssociation = getAmplifyDomainAssociation({
      appId: stackOutputs.AmplifyAppId,
      domainName: args.domainName,
      region: args.region,
    });
  } catch {
    domainAssociation = null;
  }

  const customDomainState = getCustomDomainState(target, domainAssociation);
  const customDomainReady =
    customDomainState.domainStatus === "AVAILABLE" &&
    customDomainState.verificationSatisfied === true;
  const customDomainUrl = `https://${target.customDomainName}`;

  if (args.targetMode === "custom-domain") {
    if (!customDomainReady) {
      throw new Error(
        [
          `Custom domain is not ready for ${args.environmentName}.`,
          `domainStatus=${customDomainState.domainStatus ?? "null"}`,
          `verified=${String(customDomainState.verified)}`,
        ].join(" "),
      );
    }

    return {
      smokeUrl: customDomainUrl,
      selectedTarget: "custom-domain",
      fallbackReason: null,
      stackOutputs,
      customDomainState,
    };
  }

  if (args.targetMode === "default-amplify") {
    return {
      smokeUrl: amplifyUrl,
      selectedTarget: "default-amplify",
      fallbackReason: null,
      stackOutputs,
      customDomainState,
    };
  }

  return {
    smokeUrl: customDomainReady ? customDomainUrl : amplifyUrl,
    selectedTarget: customDomainReady ? "custom-domain" : "default-amplify",
    fallbackReason: customDomainReady
      ? null
      : "Custom domain is not ready yet, so the smoke uses the default Amplify domain.",
    stackOutputs,
    customDomainState,
  };
}

function resolveSmokeCredentials(environmentName) {
  const upperEnvironmentName = environmentName.toUpperCase();

  return {
    identifier:
      process.env[`LIGHTNING_${upperEnvironmentName}_SMOKE_IDENTIFIER`] ??
      process.env.LIGHTNING_SMOKE_IDENTIFIER ??
      "",
    password:
      process.env[`LIGHTNING_${upperEnvironmentName}_SMOKE_PASSWORD`] ??
      process.env.LIGHTNING_SMOKE_PASSWORD ??
      "",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolution = resolveTargetUrl(args);
  const credentials = resolveSmokeCredentials(args.environmentName);

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        environmentName: args.environmentName,
        targetMode: args.targetMode,
        selectedTarget: resolution.selectedTarget,
        fallbackReason: resolution.fallbackReason,
        smokeUrl: resolution.smokeUrl,
        amplifyAppId: resolution.stackOutputs?.AmplifyAppId ?? null,
        amplifyBranchName: resolution.stackOutputs?.AmplifyBranchName ?? null,
        amplifyDefaultDomain: resolution.stackOutputs?.AmplifyDefaultDomain ?? null,
        customDomainState: resolution.customDomainState,
      },
      null,
      2,
    ),
  );

  await run(nodeBin, [smokeScript], {
    cwd: repoRoot,
    env: {
      LIGHTNING_SMOKE_URL: resolution.smokeUrl,
      LIGHTNING_SMOKE_IDENTIFIER: credentials.identifier,
      LIGHTNING_SMOKE_PASSWORD: credentials.password,
    },
    echoStdout: true,
    echoStderr: true,
  });
}

main().catch((error) => {
  console.error("Hosted frontend smoke failed:", error);
  process.exitCode = 1;
});
