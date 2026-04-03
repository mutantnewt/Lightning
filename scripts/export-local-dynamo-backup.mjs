import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const backupRoot = join(repoRoot, "backend", ".local", "backups");

const awsBin = process.env.AWS_BIN ?? "/opt/homebrew/bin/aws";
const runtimePath = [
  dirname(awsBin),
  "/usr/local/bin",
  "/opt/homebrew/bin",
  process.env.PATH ?? "",
]
  .filter(Boolean)
  .join(":");

const envName = process.env.LIGHTNING_ENV ?? "local";
const region = process.env.AWS_REGION ?? "eu-west-2";
const stackName = process.env.LIGHTNING_CDK_STACK_NAME ?? "LightningLocalStack";

const expectedTables = [
  `lightning-books-${envName}`,
  `lightning-user-state-${envName}`,
  `lightning-book-suggestions-${envName}`,
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
        PATH: runtimePath,
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

async function runAws(args) {
  const result = await run(awsBin, args);
  return result.stdout ? JSON.parse(result.stdout) : {};
}

async function maybeDescribeStack(targetStackName) {
  try {
    const response = await runAws([
      "cloudformation",
      "describe-stacks",
      "--region",
      region,
      "--stack-name",
      targetStackName,
    ]);

    return response.Stacks?.[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      return null;
    }

    throw error;
  }
}

function outputsToMap(outputs) {
  return Object.fromEntries(
    (outputs ?? [])
      .filter((entry) => entry.OutputKey && entry.OutputValue)
      .map((entry) => [entry.OutputKey, entry.OutputValue]),
  );
}

async function maybeDescribeTable(tableName) {
  try {
    const response = await runAws([
      "dynamodb",
      "describe-table",
      "--region",
      region,
      "--table-name",
      tableName,
    ]);

    return response.Table ?? null;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("ResourceNotFoundException") ||
        error.message.includes("Requested resource not found"))
    ) {
      return null;
    }

    throw error;
  }
}

async function scanAllItems(tableName) {
  const items = [];
  let exclusiveStartKey = null;

  do {
    const args = [
      "dynamodb",
      "scan",
      "--region",
      region,
      "--table-name",
      tableName,
    ];

    if (exclusiveStartKey) {
      args.push("--exclusive-start-key", JSON.stringify(exclusiveStartKey));
    }

    const page = await runAws(args);
    items.push(...(page.Items ?? []));
    exclusiveStartKey = page.LastEvaluatedKey ?? null;
  } while (exclusiveStartKey);

  return items;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(backupRoot, `${envName}-aws-${timestamp}`);
  mkdirSync(backupDir, { recursive: true });

  const stack = await maybeDescribeStack(stackName);
  const stackOutputs = outputsToMap(stack?.Outputs);
  const tables = [
    stackOutputs.BooksTableName ?? expectedTables[0],
    stackOutputs.UserStateTableName ?? expectedTables[1],
    stackOutputs.BookSuggestionsTableName ?? expectedTables[2],
  ];

  const manifest = {
    envName,
    region,
    stackName,
    stackDetected: Boolean(stack),
    backupDir,
    tables: [],
  };

  for (const tableName of tables) {
    const description = await maybeDescribeTable(tableName);

    if (!description) {
      manifest.tables.push({
        tableName,
        exported: false,
        reason: "missing",
      });
      continue;
    }

    const items = await scanAllItems(tableName);
    writeJson(join(backupDir, `${tableName}.items.json`), items);
    writeJson(join(backupDir, `${tableName}.describe.json`), description);

    manifest.tables.push({
      tableName,
      exported: true,
      itemCount: items.length,
    });
  }

  writeJson(join(backupDir, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error("Local DynamoDB backup export failed:", error);
  process.exitCode = 1;
});
