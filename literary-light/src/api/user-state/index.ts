import {
  allowLocalRuntimeFallbacks,
  createFailClosedError,
  runtimeConfig,
} from "@/config/runtime";
import type { UserStateClient } from "./client";
import { HttpUserStateClient } from "./httpUserStateClient";
import { LocalStorageUserStateClient } from "./localStorageUserStateClient";

let cachedUserStateClient: UserStateClient | null = null;

class DisabledUserStateClient implements UserStateClient {
  readonly mode = "disabled" as const;

  subscribe(): () => void {
    return () => {
      // No-op.
    };
  }

  async listFavorites(): Promise<never> {
    throw createFailClosedError("Saved user state");
  }

  async addFavorite(): Promise<never> {
    throw createFailClosedError("Saved user state");
  }

  async removeFavorite(): Promise<never> {
    throw createFailClosedError("Saved user state");
  }

  async listReadingLists(): Promise<never> {
    throw createFailClosedError("Saved user state");
  }

  async upsertReadingList(): Promise<never> {
    throw createFailClosedError("Saved user state");
  }

  async removeReadingList(): Promise<never> {
    throw createFailClosedError("Saved user state");
  }
}

export function createUserStateClient(): UserStateClient {
  if (!cachedUserStateClient) {
    if (runtimeConfig.apiAuthBaseUrl) {
      cachedUserStateClient = new HttpUserStateClient();
    } else if (allowLocalRuntimeFallbacks()) {
      cachedUserStateClient = new LocalStorageUserStateClient();
    } else {
      cachedUserStateClient = new DisabledUserStateClient();
    }
  }

  return cachedUserStateClient;
}

export type { UserStateClient, UpsertReadingListInput } from "./client";
