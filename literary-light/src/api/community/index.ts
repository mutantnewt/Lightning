import { runtimeConfig } from "@/config/runtime";
import type { CommunityClient } from "./client";
import { HttpCommunityClient } from "./httpCommunityClient";
import { LocalStorageCommunityClient } from "./localStorageCommunityClient";

export type { CommunityClient, RatingSummary } from "./client";

export function createCommunityClient(): CommunityClient {
  if (runtimeConfig.apiPublicBaseUrl || runtimeConfig.apiAuthBaseUrl) {
    return new HttpCommunityClient();
  }

  return new LocalStorageCommunityClient();
}
