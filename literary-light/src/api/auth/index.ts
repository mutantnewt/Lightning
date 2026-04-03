import { isCognitoConfigured } from "@/config/runtime";
import type { AuthClient } from "./client";
import { CognitoAuthClient } from "./cognitoAuthClient";
import { LocalStorageAuthClient } from "./localStorageAuthClient";

export function createAuthClient(): AuthClient {
  return isCognitoConfigured()
    ? new CognitoAuthClient()
    : new LocalStorageAuthClient();
}

export type { AuthClient } from "./client";
