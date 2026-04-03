#!/usr/bin/env node

import {
  buildHostedFrontendUrlFromOutputs,
  defaultRegion,
  getHostedFrontendTargets,
  getStackOutputs,
  infraDir,
  lightningRootDomainName,
  npmCli,
  run,
} from "./domain-cutover-lib.mjs";

function parseArgs(argv) {
  const args = {
    environmentName: "staging",
    domainName: lightningRootDomainName,
    region: defaultRegion,
    forceDeploy: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environmentName = next;
        index += 1;
        break;
      case "--domain":
        args.domainName = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
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

  if (!["staging", "production"].includes(args.environmentName)) {
    throw new Error("--environment must be either staging or production.");
  }

  return args;
}

function listOrigins(value) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const frontendTarget = getHostedFrontendTargets(args.domainName)[
    args.environmentName
  ];
  const frontendOutputs = getStackOutputs(frontendTarget.stackName, args.region);
  const hostedFrontendUrl = buildHostedFrontendUrlFromOutputs(frontendOutputs);
  const backendStackName =
    args.environmentName === "production"
      ? "LightningProductionStack"
      : "LightningStagingStack";
  const deployScript =
    args.environmentName === "production"
      ? "deploy:frontend:production:precutover"
      : "deploy:frontend:staging";

  const currentBackendOutputs = getStackOutputs(backendStackName, args.region);
  const currentCorsAllowedOrigins = listOrigins(
    currentBackendOutputs.CorsAllowedOrigins ?? "",
  );

  if (
    currentCorsAllowedOrigins.includes(hostedFrontendUrl) &&
    !args.forceDeploy
  ) {
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          environmentName: args.environmentName,
          backendStackName,
          hostedFrontendUrl,
          skipped: true,
          reason: "Hosted frontend URL is already present in CorsAllowedOrigins.",
          corsAllowedOrigins: currentCorsAllowedOrigins,
          forceDeploy: false,
        },
        null,
        2,
      ),
    );
    return;
  }

  run(
    npmCli,
    [
      "run",
      deployScript,
      "--",
      "--context",
      `extraCorsOrigins=${hostedFrontendUrl}`,
    ],
    {
      cwd: infraDir,
      stdio: "inherit",
    },
  );

  const updatedBackendOutputs = getStackOutputs(backendStackName, args.region);
  const updatedCorsAllowedOrigins = listOrigins(
    updatedBackendOutputs.CorsAllowedOrigins ?? "",
  );

  if (!updatedCorsAllowedOrigins.includes(hostedFrontendUrl)) {
    throw new Error(
      [
        "Hosted frontend URL was not present after the backend deploy.",
        `Expected to find: ${hostedFrontendUrl}`,
        `Actual CorsAllowedOrigins: ${updatedCorsAllowedOrigins.join(", ")}`,
      ].join("\n"),
    );
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        environmentName: args.environmentName,
        backendStackName,
        hostedFrontendUrl,
        skipped: false,
        forceDeploy: args.forceDeploy,
        corsAllowedOrigins: updatedCorsAllowedOrigins,
        nextSteps: [
          `Run npm run smoke:${args.environmentName}:hosted from literary-light/.`,
          args.environmentName === "production"
            ? "Run npm run cutover:finalize after registrar delegation and domain attachment to remove temporary pre-cutover origins."
            : "Keep the hosted staging URL as a pre-cutover verification origin until the custom domain is attached.",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Hosted frontend CORS preparation failed:", error);
  process.exitCode = 1;
});
