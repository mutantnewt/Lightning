#!/usr/bin/env node

import { runHostedSmokeSecretSync } from "./sync-hosted-smoke-github-secrets.mjs";

runHostedSmokeSecretSync("production").catch((error) => {
  console.error("Syncing hosted production smoke GitHub secrets failed:", error);
  process.exitCode = 1;
});
