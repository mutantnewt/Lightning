import type {
  AuthResult,
  AuthUser,
  ConfirmPasswordResetInput,
  ConfirmSignUpInput,
  RequestPasswordResetInput,
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
const PASSWORD_RESETS_STORAGE_KEY = "literary-light-password-resets";

interface StoredUser extends AuthUser {
  password: string;
}

interface StoredPasswordReset {
  userId: string;
  code: string;
  requestedAt: string;
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

function saveStoredUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function saveUser(user: StoredUser) {
  const users = getStoredUsers();
  users.push(user);
  saveStoredUsers(users);
}

function findUserByIdentifier(identifier: string): StoredUser | null {
  const users = getStoredUsers();
  const normalizedIdentifier = normalizeIdentifier(identifier);

  return (
    users.find((user) => {
      const matchesIdentifier =
        normalizeEmail(user.email) === normalizedIdentifier ||
        (user.username ? normalizeIdentifier(user.username) === normalizedIdentifier : false);
      return matchesIdentifier;
    }) ?? null
  );
}

function findUser(identifier: string, password: string): StoredUser | null {
  const user = findUserByIdentifier(identifier);

  if (!user || user.password !== password) {
    return null;
  }

  return user;
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

function getStoredPasswordResets(): Record<string, StoredPasswordReset> {
  try {
    const stored = localStorage.getItem(PASSWORD_RESETS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, StoredPasswordReset>) : {};
  } catch {
    return {};
  }
}

function saveStoredPasswordResets(
  passwordResets: Record<string, StoredPasswordReset>,
): void {
  localStorage.setItem(
    PASSWORD_RESETS_STORAGE_KEY,
    JSON.stringify(passwordResets),
  );
}

function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  async requestPasswordReset(
    input: RequestPasswordResetInput,
  ): Promise<AuthResult> {
    if (!input.identifier) {
      return {
        success: false,
        error: "Email or username is required.",
      };
    }

    const user = findUserByIdentifier(input.identifier);

    if (!user) {
      return {
        success: false,
        error: "We couldn't find an account with that email or username.",
      };
    }

    const passwordResets = getStoredPasswordResets();
    passwordResets[user.id] = {
      userId: user.id,
      code: generateResetCode(),
      requestedAt: new Date().toISOString(),
    };
    saveStoredPasswordResets(passwordResets);

    return {
      success: true,
      nextStep: "CONFIRM_RESET_PASSWORD",
      identifier: input.identifier.trim(),
      codeDeliveryDestination: user.email,
    };
  }

  async confirmPasswordReset(
    input: ConfirmPasswordResetInput,
  ): Promise<AuthResult> {
    if (!input.identifier || !input.confirmationCode || !input.newPassword) {
      return {
        success: false,
        error: "Reset code and new password are required.",
      };
    }

    const passwordValidationError = validatePassword(input.newPassword);
    if (passwordValidationError) {
      return { success: false, error: passwordValidationError };
    }

    const user = findUserByIdentifier(input.identifier);

    if (!user) {
      return {
        success: false,
        error: "We couldn't find an account with that email or username.",
      };
    }

    const passwordResets = getStoredPasswordResets();
    const resetRequest = passwordResets[user.id];

    if (!resetRequest || resetRequest.code !== input.confirmationCode.trim()) {
      return {
        success: false,
        error: "That reset code is incorrect.",
      };
    }

    const users = getStoredUsers().map((storedUser) =>
      storedUser.id === user.id
        ? {
            ...storedUser,
            password: input.newPassword,
          }
        : storedUser,
    );
    saveStoredUsers(users);

    delete passwordResets[user.id];
    saveStoredPasswordResets(passwordResets);

    return {
      success: true,
      nextStep: "DONE",
    };
  }

  async signOut(): Promise<void> {
    clearStoredLocalAuthUser();
  }
}
