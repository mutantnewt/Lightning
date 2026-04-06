import {
  allowLocalRuntimeFallbacks,
  getFailClosedMessage,
  isCognitoConfigured,
} from "@/config/runtime";
import type { AuthClient } from "./client";
import { CognitoAuthClient } from "./cognitoAuthClient";
import { LocalStorageAuthClient } from "./localStorageAuthClient";

class DisabledAuthClient implements AuthClient {
  readonly mode = "disabled" as const;

  async getCurrentUser() {
    return null;
  }

  async signIn() {
    return {
      success: false,
      error: getFailClosedMessage("Authentication"),
    };
  }

  async signUp() {
    return {
      success: false,
      error: getFailClosedMessage("Authentication"),
    };
  }

  async confirmSignUp() {
    return {
      success: false,
      error: getFailClosedMessage("Authentication"),
    };
  }

  async resendSignUpCode() {
    return {
      success: false,
      error: getFailClosedMessage("Authentication"),
    };
  }

  async requestPasswordReset() {
    return {
      success: false,
      error: getFailClosedMessage("Authentication"),
    };
  }

  async confirmPasswordReset() {
    return {
      success: false,
      error: getFailClosedMessage("Authentication"),
    };
  }

  async signOut(): Promise<void> {
    // No-op in disabled mode.
  }
}

export function createAuthClient(): AuthClient {
  if (isCognitoConfigured()) {
    return new CognitoAuthClient();
  }

  if (allowLocalRuntimeFallbacks()) {
    return new LocalStorageAuthClient();
  }

  return new DisabledAuthClient();
}

export type { AuthClient } from "./client";
