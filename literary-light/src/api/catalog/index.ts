import { runtimeConfig } from "@/config/runtime";
import type { CatalogClient } from "./client";
import { HttpCatalogClient } from "./httpCatalogClient";
import { LocalCatalogClient } from "./localCatalogClient";

export type { CatalogClient } from "./client";

export function createCatalogClient(): CatalogClient {
  if (
    runtimeConfig.apiPublicBaseUrl ||
    runtimeConfig.apiAuthBaseUrl ||
    runtimeConfig.apiPrivilegedBaseUrl
  ) {
    return new HttpCatalogClient();
  }

  return new LocalCatalogClient();
}
