import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

let hasLoadedBackendEnv = false;

export function loadBackendEnv(): void {
  if (hasLoadedBackendEnv) {
    return;
  }

  const cwd = process.cwd();
  const shellDefinedKeys = new Set(Object.keys(process.env));
  const envFiles = [resolve(cwd, ".env"), resolve(cwd, ".env.local")];

  for (const filePath of envFiles) {
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnv(readFileSync(filePath, "utf8"));

    for (const [key, value] of Object.entries(parsed)) {
      if (shellDefinedKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }
  }

  hasLoadedBackendEnv = true;
}
