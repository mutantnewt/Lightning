#!/usr/bin/env node

import { appendFileSync } from "node:fs";

function parseArgs(argv) {
  const args = {
    environment: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environment = next;
        index += 1;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["staging", "production"].includes(args.environment)) {
    throw new Error("--environment must be staging or production.");
  }

  return args;
}

function buildSummary(environment) {
  const isProduction = environment === "production";
  const targetLines = isProduction
    ? [
        "- target URLs:",
        "  - `https://lightningclassics.com`",
        "  - `https://www.lightningclassics.com`",
        "- smoke coverage: canonical apex plus `www` redirect path",
        "- expected smoke user: `Production Local Smoke`",
      ]
    : [
        "- target URL: `https://staging.lightningclassics.com`",
        "- smoke coverage: canonical staging custom domain",
        "- expected smoke user: `Staging Local Smoke`",
      ];

  return [
    "## Hosted smoke",
    "",
    `- environment: ${environment}`,
    ...targetLines,
    "- result: workflow reached this summary step, so the hosted smoke command completed successfully",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = buildSummary(args.environment);
  process.stdout.write(`${summary}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

main();
