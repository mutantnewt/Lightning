import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { AuthUser } from "../../contracts/auth";
import type { HttpEvent } from "./http";
import { getEnv } from "./env";

type CognitoClaims = Record<string, unknown>;
type CognitoVerifier = ReturnType<typeof CognitoJwtVerifier.create>;

export interface AuthenticatedRequestContext {
  user: AuthUser;
  groups: string[];
  claims: CognitoClaims | Record<string, unknown>;
}

let cognitoVerifier: CognitoVerifier | null | undefined;

function getHeader(
  headers: Record<string, string | undefined> | undefined,
  name: string,
): string | null {
  if (!headers) {
    return null;
  }

  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );

  if (!match) {
    return null;
  }

  const value = match[1];
  return value ? value.trim() || null : null;
}

function getClaimString(
  claims: CognitoClaims | Record<string, string | undefined>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = claims[key];

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

function getClaimStringList(
  claims: CognitoClaims | Record<string, unknown>,
  ...keys: string[]
): string[] {
  for (const key of keys) {
    const value = claims[key];

    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;

          if (Array.isArray(parsed)) {
            return parsed
              .filter((entry): entry is string => typeof entry === "string")
              .map((entry) => entry.trim())
              .filter(Boolean);
          }
        } catch {
          // Fall through to comma-separated parsing.
        }
      }

      return trimmed
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function getAuthorizationBearerToken(event: HttpEvent): string | null {
  const authorizationHeader = getHeader(event.headers, "authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim() || null;
}

function getCognitoVerifier(): CognitoVerifier | null {
  if (typeof cognitoVerifier !== "undefined") {
    return cognitoVerifier;
  }

  const userPoolId = getEnv("COGNITO_USER_POOL_ID");

  if (!userPoolId) {
    cognitoVerifier = null;
    return null;
  }

  cognitoVerifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: null,
    clientId: getEnv("COGNITO_APP_CLIENT_ID") ?? null,
  });

  return cognitoVerifier;
}

function getLocalAuthenticatedContext(
  event: HttpEvent,
): AuthenticatedRequestContext | null {
  if (getEnv("ALLOW_LOCAL_AUTH_HEADERS") !== "true") {
    return null;
  }

  const id = getHeader(event.headers, "x-lightning-local-user-id");

  if (!id) {
    return null;
  }

  const username = getHeader(event.headers, "x-lightning-local-username");
  const email = getHeader(event.headers, "x-lightning-local-user-email") ?? username ?? "";
  const name = getHeader(event.headers, "x-lightning-local-user-name") ?? (email || id);
  const groups = (
    getHeader(event.headers, "x-lightning-local-user-groups") ?? ""
  )
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);

  return {
    user: {
      id,
      username,
      email,
      name,
      createdAt: null,
      groups,
    },
    groups,
    claims: {},
  };
}

async function getVerifiedCognitoClaims(
  event: HttpEvent,
): Promise<CognitoClaims | Record<string, string | undefined> | null> {
  const gatewayClaims = event.requestContext?.authorizer?.jwt?.claims;
  const token = getAuthorizationBearerToken(event);
  const verifier = getCognitoVerifier();
  let verifiedClaims: CognitoClaims | Record<string, string | undefined> | null =
    null;

  if (token && verifier) {
    try {
      verifiedClaims = await verifier.verify(token);
    } catch (error) {
      console.warn("Unable to verify Cognito bearer token:", error);
    }
  }

  if (gatewayClaims && verifiedClaims) {
    return {
      ...gatewayClaims,
      ...verifiedClaims,
    };
  }

  return verifiedClaims ?? gatewayClaims ?? null;
}

export async function getAuthenticatedUser(
  event: HttpEvent,
): Promise<AuthUser | null> {
  const context = await getAuthenticatedRequestContext(event);

  return context?.user ?? null;
}

export async function getAuthenticatedRequestContext(
  event: HttpEvent,
): Promise<AuthenticatedRequestContext | null> {
  const localContext = getLocalAuthenticatedContext(event);

  if (localContext) {
    return localContext;
  }

  const claims = await getVerifiedCognitoClaims(event);

  if (!claims) {
    return null;
  }

  const id = getClaimString(claims, "sub", "cognito:username", "username");
  const username = getClaimString(claims, "cognito:username", "username");
  const email = getClaimString(claims, "email") ?? username ?? "";

  if (!id) {
    return null;
  }

  return {
    user: {
      id,
      username,
      email,
      name:
        (
          getClaimString(claims, "name", "preferred_username", "email", "username") ??
          email
        ) || id,
      createdAt: getClaimString(claims, "custom:created_at"),
      groups: getClaimStringList(claims, "cognito:groups", "groups"),
    },
    groups: getClaimStringList(claims, "cognito:groups", "groups"),
    claims,
  };
}

export function isUserInGroup(
  context: Pick<AuthenticatedRequestContext, "groups">,
  groupName: string | null | undefined,
): boolean {
  if (!groupName) {
    return false;
  }

  return context.groups.includes(groupName);
}
