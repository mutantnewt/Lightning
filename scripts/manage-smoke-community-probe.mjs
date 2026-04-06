import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const helperScript = join(
  __dirname,
  "..",
  "backend",
  "scripts",
  "manageSmokeCommunityProbe.mjs",
);
const nodeBin = process.env.NODE_BIN ?? process.execPath;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? __dirname,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
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
  const result = await run(nodeBin, [helperScript, ...process.argv.slice(2)], {
    cwd: join(__dirname, ".."),
    env: {
      LIGHTNING_SMOKE_ENV: process.env.LIGHTNING_SMOKE_ENV ?? "local",
    },
  });

  if (result.stdout) {
    console.log(result.stdout);
  }
}

main().catch((error) => {
  console.error("Smoke community probe wrapper failed:", error);
  process.exitCode = 1;
});
