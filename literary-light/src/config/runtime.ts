import type { AuthProviderMode } from "@contracts/auth";

function normalizeBaseUrl(value?: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export interface RuntimeConfig {
  appEnv: string;
  awsRegion: string | null;
  cognitoUserPoolId: string | null;
  cognitoUserPoolClientId: string | null;
  cognitoIdentityPoolId: string | null;
  catalogModeratorGroupName: string;
  apiPublicBaseUrl: string | null;
  apiAuthBaseUrl: string | null;
  apiPrivilegedBaseUrl: string | null;
  siteUrl: string | null;
  authMode: AuthProviderMode;
}

const cognitoUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? null;
const cognitoUserPoolClientId =
  import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID ?? null;

export const runtimeConfig: RuntimeConfig = {
  appEnv: import.meta.env.VITE_APP_ENV ?? "local",
  awsRegion: import.meta.env.VITE_AWS_REGION ?? null,
  cognitoUserPoolId,
  cognitoUserPoolClientId,
  cognitoIdentityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID ?? null,
  catalogModeratorGroupName:
    import.meta.env.VITE_CATALOG_MODERATOR_GROUP_NAME ??
    `lightning-catalog-moderators-${import.meta.env.VITE_APP_ENV ?? "local"}`,
  apiPublicBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_PUBLIC_BASE_URL),
  apiAuthBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_AUTH_BASE_URL),
  apiPrivilegedBaseUrl: normalizeBaseUrl(
    import.meta.env.VITE_API_PRIVILEGED_BASE_URL,
  ),
  siteUrl: normalizeBaseUrl(import.meta.env.VITE_SITE_URL),
  authMode:
    cognitoUserPoolId && cognitoUserPoolClientId ? "cognito" : "local",
};

export function isCognitoConfigured(): boolean {
  return runtimeConfig.authMode === "cognito";
}

export function isCatalogModerator(groups: string[] | null | undefined): boolean {
  return Boolean(
    groups?.includes(runtimeConfig.catalogModeratorGroupName),
  );
}
