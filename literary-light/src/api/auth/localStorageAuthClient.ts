import type {
  AuthResult,
  AuthUser,
  ConfirmSignUpInput,
  ResendSignUpCodeInput,
  SignInInput,
  SignUpInput,
} from "@contracts/auth";
import type { AuthClient } from "./client";
import { generateImmutableUsername } from "./generateImmutableUsername";
import {
  clearStoredLocalAuthUser,
  getStoredLocalAuthUser,
  persistLocalAuthUser,
} from "./localSession";
import { validatePassword } from "./passwordPolicy";

const USERS_STORAGE_KEY = "literary-light-users";

interface StoredUser extends AuthUser {
  password: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function getStoredUsers(): StoredUser[] {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function saveUser(user: StoredUser) {
  const users = getStoredUsers();
  users.push(user);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function findUser(identifier: string, password: string): StoredUser | null {
  const users = getStoredUsers();
  const normalizedIdentifier = normalizeIdentifier(identifier);

  return (
    users.find((user) => {
      const matchesIdentifier =
        normalizeEmail(user.email) === normalizedIdentifier ||
        (user.username ? normalizeIdentifier(user.username) === normalizedIdentifier : false);

      return matchesIdentifier && user.password === password;
    }) ?? null
  );
}

function emailExists(email: string): boolean {
  const users = getStoredUsers();
  const normalizedEmail = normalizeEmail(email);
  return users.some((user) => normalizeEmail(user.email) === normalizedEmail);
}

function usernameExists(username: string): boolean {
  const users = getStoredUsers();
  const normalizedUsername = normalizeIdentifier(username);
  return users.some((user) => normalizeIdentifier(user.username ?? "") === normalizedUsername);
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    username: user.username ?? null,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt ?? null,
    groups: Array.isArray(user.groups) ? user.groups : [],
  };
}

export class LocalStorageAuthClient implements AuthClient {
  readonly mode = "local" as const;

  async getCurrentUser(): Promise<AuthUser | null> {
    const storedUser = getStoredLocalAuthUser();
    return storedUser ? toAuthUser(storedUser as StoredUser) : null;
  }

  async signIn(input: SignInInput): Promise<AuthResult> {
    if (!input.identifier || !input.password) {
      return { success: false, error: "Email or username and password are required" };
    }

    const storedUser = findUser(input.identifier, input.password);
    if (!storedUser) {
      return { success: false, error: "Invalid email, username, or password" };
    }

    const user = toAuthUser(storedUser);
    persistLocalAuthUser(user);

    return { success: true, user };
  }

  async signUp(input: SignUpInput): Promise<AuthResult> {
    if (!input.email || !input.password || !input.name) {
      return { success: false, error: "All fields are required" };
    }

    const passwordValidationError = validatePassword(input.password);
    if (passwordValidationError) {
      return { success: false, error: passwordValidationError };
    }

    if (emailExists(input.email)) {
      return { success: false, error: "Email already registered" };
    }

    let username = generateImmutableUsername();
    while (usernameExists(username)) {
      username = generateImmutableUsername();
    }

    const normalizedEmail = normalizeEmail(input.email);

    const newUser: StoredUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      username,
      email: normalizedEmail,
      password: input.password,
      name: input.name.trim(),
      createdAt: new Date().toISOString(),
      groups: [],
    };

    saveUser(newUser);

    const user = toAuthUser(newUser);
    persistLocalAuthUser(user);

    return { success: true, user };
  }

  async confirmSignUp(_input: ConfirmSignUpInput): Promise<AuthResult> {
    return {
      success: true,
      nextStep: "DONE",
    };
  }

  async resendSignUpCode(input: ResendSignUpCodeInput): Promise<AuthResult> {
    return {
      success: true,
      nextStep: "CONFIRM_SIGN_UP",
      identifier: input.identifier,
    };
  }

  async signOut(): Promise<void> {
    clearStoredLocalAuthUser();
  }
}
