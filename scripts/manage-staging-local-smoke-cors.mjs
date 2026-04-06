#!/usr/bin/env node

import {
  defaultRegion,
  getStackOutputs,
  infraDir,
  npmCli,
  run,
} from "./domain-cutover-lib.mjs";

const defaultFrontendOrigin = "http://127.0.0.1:5175";
const canonicalStagingOrigin = "https://staging.lightningclassics.com";
const stagingStackName = "LightningStagingStack";

function parseArgs(argv) {
  const args = {
    action: "enable",
    region: defaultRegion,
    frontendOrigin:
      process.env.LIGHTNING_FRONTEND_ORIGIN ?? defaultFrontendOrigin,
    forceDeploy: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--action":
        args.action = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--frontend-origin":
        args.frontendOrigin = next;
        index += 1;
        break;
      case "--force":
      case "--force-deploy":
        args.forceDeploy = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["enable", "restore"].includes(args.action)) {
    throw new Error("--action must be either enable or restore.");
  }

  return args;
}

function listOrigins(value) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildResult(args, currentCorsAllowedOrigins, overrides = {}) {
  return {
    observedAt: new Date().toISOString(),
    action: args.action,
    region: args.region,
    frontendOrigin: args.frontendOrigin,
    stagingStackName,
    canonicalStagingOrigin,
    corsAllowedOrigins: currentCorsAllowedOrigins,
    ...overrides,
  };
}

function shouldSkipEnable(currentCorsAllowedOrigins, frontendOrigin) {
  return (
    currentCorsAllowedOrigins.includes(frontendOrigin) &&
    currentCorsAllowedOrigins.includes(canonicalStagingOrigin)
  );
}

function shouldSkipRestore(currentCorsAllowedOrigins, frontendOrigin) {
  return (
    !currentCorsAllowedOrigins.includes(frontendOrigin) &&
    currentCorsAllowedOrigins.includes(canonicalStagingOrigin)
  );
}

function verifyEnable(currentCorsAllowedOrigins, frontendOrigin) {
  if (!currentCorsAllowedOrigins.includes(frontendOrigin)) {
    throw new Error(
      [
        "Staging local smoke CORS enable did not add the requested frontend origin.",
        `Expected origin: ${frontendOrigin}`,
        `Actual CorsAllowedOrigins: ${currentCorsAllowedOrigins.join(", ")}`,
      ].join("\n"),
    );
  }

  if (!currentCorsAllowedOrigins.includes(canonicalStagingOrigin)) {
    throw new Error(
      [
        "Staging local smoke CORS enable removed the canonical staging origin unexpectedly.",
        `Expected origin: ${canonicalStagingOrigin}`,
        `Actual CorsAllowedOrigins: ${currentCorsAllowedOrigins.join(", ")}`,
      ].join("\n"),
    );
  }
}

function verifyRestore(currentCorsAllowedOrigins, frontendOrigin) {
  if (currentCorsAllowedOrigins.includes(frontendOrigin)) {
    throw new Error(
      [
        "Staging canonical CORS restore did not remove the temporary local smoke origin.",
        `Unexpected origin: ${frontendOrigin}`,
        `Actual CorsAllowedOrigins: ${currentCorsAllowedOrigins.join(", ")}`,
      ].join("\n"),
    );
  }

  if (!currentCorsAllowedOrigins.includes(canonicalStagingOrigin)) {
    throw new Error(
      [
        "Staging canonical CORS restore is missing the canonical staging origin.",
        `Expected origin: ${canonicalStagingOrigin}`,
        `Actual CorsAllowedOrigins: ${currentCorsAllowedOrigins.join(", ")}`,
      ].join("\n"),
    );
  }
}

function deployEnable(frontendOrigin) {
  run(
    npmCli,
    [
      "run",
      "deploy:frontend:staging",
      "--",
      "--context",
      `frontendOrigin=${frontendOrigin}`,
    ],
    {
      cwd: infraDir,
      stdio: "inherit",
    },
  );
}

function deployRestore() {
  run(npmCli, ["run", "deploy:frontend:staging"], {
    cwd: infraDir,
    stdio: "inherit",
  });
}

function getCurrentCorsAllowedOrigins(region) {
  const outputs = getStackOutputs(stagingStackName, region);
  return listOrigins(outputs.CorsAllowedOrigins ?? "");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentCorsAllowedOrigins = getCurrentCorsAllowedOrigins(args.region);

  if (
    args.action === "enable" &&
    shouldSkipEnable(currentCorsAllowedOrigins, args.frontendOrigin) &&
    !args.forceDeploy
  ) {
    console.log(
      JSON.stringify(
        buildResult(args, currentCorsAllowedOrigins, {
          skipped: true,
          reason:
            "Temporary local staging smoke origin is already present in CorsAllowedOrigins.",
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (
    args.action === "restore" &&
    shouldSkipRestore(currentCorsAllowedOrigins, args.frontendOrigin) &&
    !args.forceDeploy
  ) {
    console.log(
      JSON.stringify(
        buildResult(args, currentCorsAllowedOrigins, {
          skipped: true,
          reason:
            "Staging CorsAllowedOrigins already matches the canonical post-smoke baseline.",
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (args.action === "enable") {
    deployEnable(args.frontendOrigin);
  } else {
    deployRestore();
  }

  const updatedCorsAllowedOrigins = getCurrentCorsAllowedOrigins(args.region);

  if (args.action === "enable") {
    verifyEnable(updatedCorsAllowedOrigins, args.frontendOrigin);
  } else {
    verifyRestore(updatedCorsAllowedOrigins, args.frontendOrigin);
  }

  console.log(
    JSON.stringify(
      buildResult(args, updatedCorsAllowedOrigins, {
        skipped: false,
      }),
      null,
      2,
    ),
  );
}

main();
