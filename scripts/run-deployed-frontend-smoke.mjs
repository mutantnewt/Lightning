import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const frontendDir = join(repoRoot, "literary-light");
const bootstrapScript = join(__dirname, "bootstrap-local-aws.mjs");
const smokeScript = join(__dirname, "local-frontend-smoke.mjs");

const nodeBin = process.env.NODE_BIN ?? process.execPath;
const npmBin = process.env.NPM_BIN ?? "/usr/local/bin/npm";
const frontendOrigin =
  process.env.LIGHTNING_FRONTEND_ORIGIN ?? "http://127.0.0.1:5175";
const frontendUrl =
  process.env.LIGHTNING_SMOKE_URL ?? `${frontendOrigin.replace(/\/$/, "")}/`;
const frontendReadyTimeoutMs = 30_000;
const bootstrapEnvName =
  process.env.LIGHTNING_BOOTSTRAP_ENV ??
  process.env.LIGHTNING_ENV ??
  "local";
const bootstrapStackName =
  process.env.LIGHTNING_BOOTSTRAP_STACK_NAME ??
  process.env.LIGHTNING_CDK_STACK_NAME ??
  "LightningLocalStack";
const bootstrapSiteUrl =
  process.env.LIGHTNING_BOOTSTRAP_SITE_URL ??
  process.env.LIGHTNING_SITE_URL ??
  frontendOrigin;
const restoreEnvName = process.env.LIGHTNING_RESTORE_ENV ?? "local";
const restoreStackName =
  process.env.LIGHTNING_RESTORE_STACK_NAME ?? "LightningLocalStack";
const restoreSiteUrl =
  process.env.LIGHTNING_RESTORE_SITE_URL ?? frontendOrigin;

const sharedEnv = {
  ...process.env,
  LIGHTNING_FRONTEND_ORIGIN: frontendOrigin,
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...sharedEnv,
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
            `Command failed: ${command} ${args.join(" ")}`,
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertFrontendPortAvailable(urlString) {
  try {
    const response = await fetch(urlString);

    if (response.ok) {
      const url = new URL(urlString);
      const port = Number(url.port || (url.protocol === "https:" ? "443" : "80"));
      const host = url.hostname;

      throw new Error(
        [
          `Port ${port} on ${host} is already serving a frontend.`,
          "Stop the existing frontend dev server before running the deployed smoke command.",
        ].join(" "),
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("already serving a frontend")) {
      throw error;
    }

    // If the frontend is not reachable yet, the temporary Vite server can take over.
  }
}

function startFrontendServer() {
  const child = spawn(npmBin, ["run", "dev"], {
    cwd: frontendDir,
    env: sharedEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    stdout += text;
    process.stdout.write(text);
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    stderr += text;
    process.stderr.write(text);
  });

  return {
    child,
    getLogs() {
      return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    },
  };
}

async function waitForFrontendReady(urlString, frontendServer) {
  const deadline = Date.now() + frontendReadyTimeoutMs;

  while (Date.now() < deadline) {
    if (frontendServer.child.exitCode !== null) {
      throw new Error(
        [
          "Frontend dev server exited before it became ready.",
          frontendServer.getLogs(),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    try {
      const response = await fetch(urlString);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the dev server responds or times out.
    }

    await delay(500);
  }

  throw new Error(
    [
      `Timed out waiting for the frontend at ${urlString}.`,
      frontendServer.getLogs(),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function stopFrontendServer(frontendServer) {
  if (!frontendServer) {
    return;
  }

  const { child } = frontendServer;

  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  const exitResult = await Promise.race([
    once(child, "close"),
    delay(5_000).then(() => null),
  ]);

  if (exitResult === null && child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "close");
  }
}

async function switchFrontendMode(frontendApiMode, envOverrides = {}) {
  return run(
    nodeBin,
    [bootstrapScript, "--require-cdk", "--skip-seed"],
    {
      env: {
        LIGHTNING_FRONTEND_API_MODE: frontendApiMode,
        ...envOverrides,
      },
      echoStdout: true,
      echoStderr: true,
    },
  );
}

async function runSmoke() {
  return run(nodeBin, [smokeScript], {
    env: {
      LIGHTNING_SMOKE_URL: frontendUrl,
      LIGHTNING_SMOKE_ENV: bootstrapEnvName,
    },
    echoStdout: true,
    echoStderr: true,
  });
}

async function main() {
  let frontendServer = null;
  let switchedToDeployedMode = false;
  let primaryError = null;
  let restoreError = null;

  console.log(`Checking frontend port availability for ${frontendOrigin} ...`);
  await assertFrontendPortAvailable(frontendOrigin);

  try {
    console.log("Switching frontend env to deployed API mode ...");
    await switchFrontendMode("deployed-api", {
      LIGHTNING_ENV: bootstrapEnvName,
      LIGHTNING_CDK_STACK_NAME: bootstrapStackName,
      LIGHTNING_SITE_URL: bootstrapSiteUrl,
    });
    switchedToDeployedMode = true;

    console.log("Starting a temporary frontend dev server for deployed smoke verification ...");
    frontendServer = startFrontendServer();
    await waitForFrontendReady(frontendUrl, frontendServer);

    console.log("Running the browser-led deployed smoke ...");
    await runSmoke();
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await stopFrontendServer(frontendServer);
    } catch (error) {
      restoreError =
        restoreError ??
        new Error(
          `Failed to stop the temporary frontend dev server: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
    }

    if (switchedToDeployedMode) {
      try {
        console.log("Restoring frontend env to local-backend mode ...");
        await switchFrontendMode("local-backend", {
          LIGHTNING_ENV: restoreEnvName,
          LIGHTNING_CDK_STACK_NAME: restoreStackName,
          LIGHTNING_SITE_URL: restoreSiteUrl,
        });
      } catch (error) {
        restoreError =
          restoreError ??
          new Error(
            `Failed to restore frontend env to local-backend mode: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
      }
    }
  }

  if (primaryError && restoreError) {
    throw new Error(
      [
        primaryError instanceof Error ? primaryError.message : String(primaryError),
        restoreError.message,
      ].join("\n\n"),
    );
  }

  if (primaryError) {
    throw primaryError;
  }

  if (restoreError) {
    throw restoreError;
  }

  console.log("Deployed frontend smoke completed successfully and local-backend mode was restored.");
}

main().catch((error) => {
  console.error("Deployed frontend smoke failed:", error);
  process.exitCode = 1;
});
