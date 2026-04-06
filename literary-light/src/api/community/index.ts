import {
  allowLocalRuntimeFallbacks,
  createFailClosedError,
  runtimeConfig,
} from "@/config/runtime";
import type { CommunityClient } from "./client";
import { HttpCommunityClient } from "./httpCommunityClient";
import { LocalStorageCommunityClient } from "./localStorageCommunityClient";

export type {
  CommunityClient,
  CommunityPage,
  CommunityPageRequest,
  RatingSummary,
} from "./client";

class DisabledCommunityClient implements CommunityClient {
  readonly mode = "disabled" as const;

  subscribe(): () => void {
    return () => {
      // No-op.
    };
  }

  async listComments(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async addComment(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async deleteComment(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async getRatingSummary(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async getUserRating(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async setRating(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async listReviews(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async addReview(): Promise<never> {
    throw createFailClosedError("Community features");
  }

  async deleteReview(): Promise<never> {
    throw createFailClosedError("Community features");
  }
}

export function createCommunityClient(): CommunityClient {
  if (runtimeConfig.apiPublicBaseUrl || runtimeConfig.apiAuthBaseUrl) {
    return new HttpCommunityClient();
  }

  if (allowLocalRuntimeFallbacks()) {
    return new LocalStorageCommunityClient();
  }

  return new DisabledCommunityClient();
}
