import {
  allowLocalRuntimeFallbacks,
  createFailClosedError,
  runtimeConfig,
} from "@/config/runtime";
import type { ModerationClient } from "./client";
import { HttpModerationClient } from "./httpModerationClient";
import { LocalModerationClient } from "./localModerationClient";

export type { ModerationClient } from "./client";

class DisabledModerationClient implements ModerationClient {
  readonly mode = "disabled" as const;

  async listPendingSubmissions(): Promise<never> {
    throw createFailClosedError("Moderation services");
  }

  async acceptSubmission(): Promise<never> {
    throw createFailClosedError("Moderation services");
  }

  async deferSubmission(): Promise<never> {
    throw createFailClosedError("Moderation services");
  }

  async rejectSubmission(): Promise<never> {
    throw createFailClosedError("Moderation services");
  }
}

export function createModerationClient(): ModerationClient {
  if (
    runtimeConfig.apiPrivilegedBaseUrl ||
    runtimeConfig.apiAuthBaseUrl ||
    runtimeConfig.apiPublicBaseUrl
  ) {
    return new HttpModerationClient();
  }

  if (allowLocalRuntimeFallbacks()) {
    return new LocalModerationClient();
  }

  return new DisabledModerationClient();
}
