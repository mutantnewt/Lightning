#!/usr/bin/env node

import { runHostedSmokeSecretSync } from "./sync-hosted-smoke-github-secrets.mjs";

runHostedSmokeSecretSync("staging").catch((error) => {
  console.error("Syncing hosted staging smoke GitHub secrets failed:", error);
  process.exitCode = 1;
});
