import type { AuthUser } from "@contracts/auth";

export const LOCAL_AUTH_STORAGE_KEY = "literary-light-auth";

function parseStoredUser(value: string | null): AuthUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}

export function getStoredLocalAuthUser(): AuthUser | null {
  const user = parseStoredUser(localStorage.getItem(LOCAL_AUTH_STORAGE_KEY));

  if (!user) {
    return null;
  }

  return {
    ...user,
    groups: Array.isArray(user.groups) ? user.groups : [],
  };
}

export function persistLocalAuthUser(user: AuthUser): void {
  localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredLocalAuthUser(): void {
  localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
}

export function getLocalAuthHeaders(): Record<string, string> {
  const user = getStoredLocalAuthUser();

  if (!user) {
    return {};
  }

  return {
    "x-lightning-local-user-id": user.id,
    "x-lightning-local-user-email": user.email,
    "x-lightning-local-user-name": user.name,
    ...(user.username ? { "x-lightning-local-username": user.username } : {}),
    ...(user.groups.length > 0
      ? { "x-lightning-local-user-groups": user.groups.join(",") }
      : {}),
  };
}
