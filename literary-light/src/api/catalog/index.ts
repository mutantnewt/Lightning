import {
  allowLocalRuntimeFallbacks,
  createFailClosedError,
  runtimeConfig,
} from "@/config/runtime";
import type { CatalogClient } from "./client";
import { HttpCatalogClient } from "./httpCatalogClient";
import { LocalCatalogClient } from "./localCatalogClient";

export type { CatalogClient } from "./client";

class DisabledCatalogClient implements CatalogClient {
  readonly mode = "disabled" as const;

  async listBooks(): Promise<never> {
    throw createFailClosedError("Catalog services");
  }

  async listFaqEntries(): Promise<never> {
    throw createFailClosedError("Catalog services");
  }

  async listBooksByAuthor(): Promise<never> {
    throw createFailClosedError("Catalog services");
  }

  async createBook(): Promise<never> {
    throw createFailClosedError("Catalog services");
  }
}

export function createCatalogClient(): CatalogClient {
  if (
    runtimeConfig.apiPublicBaseUrl ||
    runtimeConfig.apiAuthBaseUrl ||
    runtimeConfig.apiPrivilegedBaseUrl
  ) {
    return new HttpCatalogClient();
  }

  if (allowLocalRuntimeFallbacks()) {
    return new LocalCatalogClient();
  }

  return new DisabledCatalogClient();
}
