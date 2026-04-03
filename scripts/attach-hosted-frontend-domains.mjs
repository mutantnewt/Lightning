#!/usr/bin/env node

import {
  defaultRegion,
  getDelegationStatus,
  getHostedFrontendTargets,
  getStackOutputs,
  infraDir,
  lightningDnsStackName,
  lightningRootDomainName,
  npmCli,
  run,
} from "./domain-cutover-lib.mjs";

function parseArgs(argv) {
  const args = {
    environmentName: "all",
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
    deploymentMode: "MANUAL",
    accessToken: process.env.AMPLIFY_ACCESS_TOKEN ?? "",
    customCertificateArn: process.env.AMPLIFY_CUSTOM_CERTIFICATE_ARN ?? "",
    allowDelegationMismatch: false,
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
      case "--dns-stack-name":
        args.dnsStackName = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--deployment-mode":
        args.deploymentMode = next;
        index += 1;
        break;
      case "--access-token":
        args.accessToken = next;
        index += 1;
        break;
      case "--custom-certificate-arn":
        args.customCertificateArn = next;
        index += 1;
        break;
      case "--allow-delegation-mismatch":
        args.allowDelegationMismatch = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["staging", "production", "all"].includes(args.environmentName)) {
    throw new Error(
      "--environment must be one of: staging, production, all.",
    );
  }

  if (!["MANUAL", "REPOSITORY"].includes(args.deploymentMode)) {
    throw new Error(
      "--deployment-mode must be either MANUAL or REPOSITORY.",
    );
  }

  if (args.deploymentMode === "REPOSITORY" && !args.accessToken) {
    throw new Error(
      "REPOSITORY deployment mode requires --access-token or AMPLIFY_ACCESS_TOKEN.",
    );
  }

  return args;
}

function buildDeployArgs(target, args) {
  const scoped = (parameterName, value) =>
    `${target.stackName}:${parameterName}=${value}`;
  const deployArgs = [
    "run",
    target.deployScript,
    "--",
    "--parameters",
    scoped("EnableCustomDomainAssociation", "true"),
  ];

  if (args.deploymentMode === "REPOSITORY") {
    deployArgs.push(
      "--parameters",
      scoped("AmplifyDeploymentMode", "REPOSITORY"),
      "--parameters",
      scoped("AmplifyAccessToken", args.accessToken),
    );
  }

  deployArgs.push(
    "--parameters",
    scoped("AmplifyCustomCertificateArn", args.customCertificateArn),
  );

  return deployArgs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delegationStatus = await getDelegationStatus({
    domainName: args.domainName,
    dnsStackName: args.dnsStackName,
    region: args.region,
  });

  if (!delegationStatus.delegationMatches && !args.allowDelegationMismatch) {
    throw new Error(
      [
        `Registrar delegation for ${args.domainName} does not match the Route 53 hosted zone yet.`,
        `Expected: ${delegationStatus.expectedNameServers.join(", ")}`,
        `Current: ${delegationStatus.currentNameServers.join(", ") || "(none resolved)"}`,
        "Rerun this command after the registrar nameservers match, or pass --allow-delegation-mismatch if you intentionally want to proceed anyway.",
      ].join("\n"),
    );
  }

  const hostedFrontendTargets = getHostedFrontendTargets(args.domainName);
  const targetNames =
    args.environmentName === "all"
      ? ["staging", "production"]
      : [args.environmentName];

  const deploymentResults = [];

  for (const targetName of targetNames) {
    const target = hostedFrontendTargets[targetName];

    run(npmCli, buildDeployArgs(target, args), {
      cwd: infraDir,
      stdio: "inherit",
    });

    const stackOutputs = getStackOutputs(target.stackName, args.region);

    deploymentResults.push({
      environmentName: target.environmentName,
      stackName: target.stackName,
      customDomainName: target.customDomainName,
      amplifyAppId: stackOutputs.AmplifyAppId ?? null,
      amplifyDefaultDomain: stackOutputs.AmplifyDefaultDomain ?? null,
      amplifyDomainStatus: stackOutputs.AmplifyDomainStatus ?? null,
      amplifyDomainUpdateStatus: stackOutputs.AmplifyDomainUpdateStatus ?? null,
      amplifyDomainCertificateRecord:
        stackOutputs.AmplifyDomainCertificateRecord ?? null,
    });
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        delegationStatus,
        deploymentMode: args.deploymentMode,
        deploymentResults,
        nextSteps: [
          "Wait for Amplify domain association and certificate provisioning to complete.",
          "Verify the custom hostnames respond over HTTPS.",
          "Re-run /usr/local/bin/npm run deploy:frontend:production after production cutover so the backend cleanup deploy keeps the frontend stack in the same CDK graph.",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Hosted-frontend domain attachment failed:", error);
  process.exitCode = 1;
});
