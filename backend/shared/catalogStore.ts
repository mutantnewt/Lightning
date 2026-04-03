import { getEnv } from "./env";
import { DynamoCatalogRepository } from "./dynamoCatalogRepository";
import { LocalCatalogRepository } from "./localCatalogRepository";
import type { CatalogStore } from "./catalogTypes";

function getStorageMode(): "dynamodb" | "file" {
  const appEnv = getEnv("APP_ENV") ?? "local";
  const hasTableName = Boolean(getEnv("BOOKS_TABLE_NAME"));

  if (appEnv === "local" && !hasTableName) {
    return "file";
  }

  return "dynamodb";
}

let store: CatalogStore | null = null;

export function getCatalogStore(): CatalogStore {
  if (store) {
    return store;
  }

  store = getStorageMode() === "file"
    ? new LocalCatalogRepository()
    : new DynamoCatalogRepository();

  return store;
}
