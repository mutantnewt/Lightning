import { runtimeConfig } from "@/config/runtime";
import type { ModerationClient } from "./client";
import { HttpModerationClient } from "./httpModerationClient";
import { LocalModerationClient } from "./localModerationClient";

export type { ModerationClient } from "./client";

export function createModerationClient(): ModerationClient {
  if (
    runtimeConfig.apiPrivilegedBaseUrl ||
    runtimeConfig.apiAuthBaseUrl ||
    runtimeConfig.apiPublicBaseUrl
  ) {
    return new HttpModerationClient();
  }

  return new LocalModerationClient();
}
