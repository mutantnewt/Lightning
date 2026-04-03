import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return {
    action: positional[0] ?? "restore",
    options,
  };
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
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
        resolvePromise({
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

function getDefaultTargetTables(outputMap) {
  return {
    books: outputMap.BooksTableName ?? `lightning-books-${envName}`,
    userState: outputMap.UserStateTableName ?? `lightning-user-state-${envName}`,
    bookSuggestions:
      outputMap.BookSuggestionsTableName ??
      `lightning-book-suggestions-${envName}`,
  };
}

function resolveLatestBackupDir() {
  if (!existsSync(backupRoot)) {
    throw new Error(`Backup root ${backupRoot} does not exist.`);
  }

  const candidateDirs = readdirSync(backupRoot)
    .map((entry) => join(backupRoot, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .filter((entryPath) =>
      entryPath.split("/").pop()?.startsWith(`${envName}-aws-`) ?? false,
    )
    .sort((left, right) => right.localeCompare(left));

  if (candidateDirs.length === 0) {
    throw new Error(
      `No backup directories were found in ${backupRoot} for env ${envName}.`,
    );
  }

  return candidateDirs[0];
}

function resolveBackupDir(options) {
  if (options["backup-dir"]) {
    return resolve(options["backup-dir"]);
  }

  return resolveLatestBackupDir();
}

function classifyTableName(tableName) {
  if (tableName.includes("-user-state-")) {
    return "userState";
  }

  if (tableName.includes("-book-suggestions-")) {
    return "bookSuggestions";
  }

  if (tableName.includes("-books-")) {
    return "books";
  }

  return null;
}

function resolveBackupTables(manifest, backupDir) {
  const mappings = {};

  for (const tableEntry of manifest.tables ?? []) {
    if (!tableEntry.exported) {
      continue;
    }

    const category = classifyTableName(tableEntry.tableName);

    if (!category) {
      continue;
    }

    const itemsPath = join(backupDir, `${tableEntry.tableName}.items.json`);

    if (!existsSync(itemsPath)) {
      throw new Error(`Missing backup items file: ${itemsPath}`);
    }

    mappings[category] = {
      sourceTableName: tableEntry.tableName,
      itemsPath,
      itemCount: tableEntry.itemCount ?? null,
    };
  }

  for (const requiredCategory of ["books", "userState", "bookSuggestions"]) {
    if (!mappings[requiredCategory]) {
      throw new Error(
        `Backup manifest does not contain an exported table for ${requiredCategory}.`,
      );
    }
  }

  return mappings;
}

async function ensureTableExists(tableName) {
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

async function scanItemCount(tableName) {
  let totalCount = 0;
  let exclusiveStartKey = null;

  do {
    const args = [
      "dynamodb",
      "scan",
      "--region",
      region,
      "--table-name",
      tableName,
      "--select",
      "COUNT",
    ];

    if (exclusiveStartKey) {
      args.push("--exclusive-start-key", JSON.stringify(exclusiveStartKey));
    }

    const response = await runAws(args);
    totalCount += Number(response.Count ?? 0);
    exclusiveStartKey = response.LastEvaluatedKey ?? null;
  } while (exclusiveStartKey);

  return totalCount;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function writeBatch(tableName, requests) {
  let pendingRequests = requests;
  let attempt = 0;

  while (pendingRequests.length > 0) {
    const response = await runAws([
      "dynamodb",
      "batch-write-item",
      "--region",
      region,
      "--request-items",
      JSON.stringify({
        [tableName]: pendingRequests,
      }),
    ]);

    const unprocessed =
      response.UnprocessedItems?.[tableName]?.filter(Boolean) ?? [];

    if (unprocessed.length === 0) {
      return;
    }

    attempt += 1;

    if (attempt >= 8) {
      throw new Error(
        `Unable to restore all items for ${tableName}; ${unprocessed.length} requests remained unprocessed after ${attempt} retries.`,
      );
    }

    pendingRequests = unprocessed;
    await sleep(250 * attempt);
  }
}

async function restoreTableItems(targetTableName, backupItems) {
  const putRequests = backupItems.map((item) => ({
    PutRequest: {
      Item: item,
    },
  }));
  const batches = chunkArray(putRequests, 10);

  for (const batch of batches) {
    await writeBatch(targetTableName, batch);
  }
}

async function main() {
  const { action, options } = parseArgs(process.argv.slice(2));

  if (action !== "restore") {
    throw new Error(`Unsupported action "${action}". Use restore.`);
  }

  const shouldDryRun = options["dry-run"] === "true";
  const shouldAllowNonEmpty = options["allow-non-empty"] === "true";
  const backupDir = resolveBackupDir(options);
  const manifestPath = join(backupDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing backup manifest: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  const backupTables = resolveBackupTables(manifest, backupDir);
  const stack = await maybeDescribeStack(stackName);
  const outputMap = outputsToMap(stack?.Outputs);
  const targetTables = getDefaultTargetTables(outputMap);
  const summary = {
    action,
    envName,
    region,
    stackName,
    stackDetected: Boolean(stack),
    backupDir,
    manifestPath,
    allowNonEmpty: shouldAllowNonEmpty,
    dryRun: shouldDryRun,
    tables: [],
  };

  for (const [category, backupTable] of Object.entries(backupTables)) {
    const targetTableName = targetTables[category];
    const targetTableDescription = await ensureTableExists(targetTableName);

    if (!targetTableDescription) {
      throw new Error(`Target table ${targetTableName} does not exist.`);
    }

    const backupItems = readJson(backupTable.itemsPath);
    const targetItemCountBefore = await scanItemCount(targetTableName);
    const tableSummary = {
      category,
      sourceTableName: backupTable.sourceTableName,
      targetTableName,
      backupItemsPath: backupTable.itemsPath,
      backupItems,
      backupItemCount:
        backupTable.itemCount ?? (Array.isArray(backupItems) ? backupItems.length : 0),
      targetItemCountBefore,
      restored: false,
      skippedReason: null,
      targetItemCountAfter: targetItemCountBefore,
    };
    summary.tables.push(tableSummary);
  }

  const blockedTables = summary.tables.filter(
    (table) => table.targetItemCountBefore > 0 && !shouldAllowNonEmpty,
  );

  if (shouldDryRun) {
    for (const table of summary.tables) {
      table.skippedReason =
        table.targetItemCountBefore > 0 && !shouldAllowNonEmpty
          ? "target-table-not-empty"
          : "dry-run";
      delete table.backupItems;
    }

    summary.wouldRequireAllowNonEmpty = blockedTables.length > 0;
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (blockedTables.length > 0) {
    const blockedNames = blockedTables
      .map(
        (table) =>
          `${table.targetTableName} (${table.targetItemCountBefore} existing items)`,
      )
      .join(", ");

    throw new Error(
      `Restore aborted because target tables are not empty: ${blockedNames}. Re-run with --allow-non-empty to merge/overwrite from the backup.`,
    );
  }

  for (const table of summary.tables) {
    await restoreTableItems(table.targetTableName, table.backupItems);
    table.restored = true;
    table.targetItemCountAfter = await scanItemCount(table.targetTableName);
    delete table.backupItems;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Local DynamoDB restore failed:", error);
  process.exitCode = 1;
});
