import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const delegatedScript = join(__dirname, "run-deployed-frontend-smoke.mjs");
const nodeBin = process.env.NODE_BIN ?? process.execPath;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
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

async function main() {
  await run(nodeBin, [delegatedScript], {
    env: {
      LIGHTNING_BOOTSTRAP_ENV:
        process.env.LIGHTNING_BOOTSTRAP_ENV ?? "staging",
      LIGHTNING_BOOTSTRAP_STACK_NAME:
        process.env.LIGHTNING_BOOTSTRAP_STACK_NAME ?? "LightningStagingStack",
      LIGHTNING_BOOTSTRAP_SITE_URL:
        process.env.LIGHTNING_BOOTSTRAP_SITE_URL ??
        "https://staging.lightningclassics.com",
      LIGHTNING_RESTORE_ENV:
        process.env.LIGHTNING_RESTORE_ENV ?? "local",
      LIGHTNING_RESTORE_STACK_NAME:
        process.env.LIGHTNING_RESTORE_STACK_NAME ?? "LightningLocalStack",
      LIGHTNING_RESTORE_SITE_URL:
        process.env.LIGHTNING_RESTORE_SITE_URL ??
        "http://127.0.0.1:5175",
      LIGHTNING_FRONTEND_ORIGIN:
        process.env.LIGHTNING_FRONTEND_ORIGIN ?? "http://127.0.0.1:5175",
    },
  });
}

main().catch((error) => {
  console.error("Staging frontend smoke failed:", error);
  process.exitCode = 1;
});
