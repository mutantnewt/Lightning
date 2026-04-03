#!/usr/bin/env node

import {
  defaultRegion,
  getDelegationStatus,
  lightningDnsStackName,
  lightningRootDomainName,
} from "./domain-cutover-lib.mjs";

function parseArgs(argv) {
  const args = {
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
    requireReady: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
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
      case "--require-ready":
        args.requireReady = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const status = await getDelegationStatus({
    domainName: args.domainName,
    dnsStackName: args.dnsStackName,
    region: args.region,
  });

  console.log(
    JSON.stringify(
      {
        ...status,
        nextStep: status.delegationMatches
          ? "Ready to attach staging and production custom domains."
          : "Update the registrar nameservers to the expected Route 53 nameservers and rerun this check.",
        recommendedCommand: status.delegationMatches
          ? "/usr/local/bin/npm run deploy:frontend:domains"
          : null,
      },
      null,
      2,
    ),
  );

  if (args.requireReady && !status.delegationMatches) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Domain cutover readiness check failed:", error);
  process.exitCode = 1;
});
