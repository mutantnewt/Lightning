import { runtimeConfig } from "@/config/runtime";
import type { UserStateClient } from "./client";
import { HttpUserStateClient } from "./httpUserStateClient";
import { LocalStorageUserStateClient } from "./localStorageUserStateClient";

let cachedUserStateClient: UserStateClient | null = null;

export function createUserStateClient(): UserStateClient {
  if (!cachedUserStateClient) {
    cachedUserStateClient = runtimeConfig.apiAuthBaseUrl
      ? new HttpUserStateClient()
      : new LocalStorageUserStateClient();
  }

  return cachedUserStateClient;
}

export type { UserStateClient, UpsertReadingListInput } from "./client";
