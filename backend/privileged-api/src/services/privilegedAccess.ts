import {
  type AuthenticatedRequestContext,
  getAuthenticatedRequestContext,
  isUserInGroup,
} from "../../../shared/auth";
import { getEnv } from "../../../shared/env";
import { forbidden, unauthorized, type HttpEvent, type HttpResponse } from "../../../shared/http";

type AuthorizationResult =
  | {
      context: AuthenticatedRequestContext;
      response: null;
    }
  | {
      context: null;
      response: HttpResponse;
    };

export function getCatalogModeratorGroupName(): string {
  return (
    getEnv("CATALOG_MODERATOR_GROUP_NAME") ??
    `lightning-catalog-moderators-${getEnv("APP_ENV") ?? "local"}`
  );
}

export async function requireAuthenticatedPrivilegedContext(
  event: HttpEvent,
): Promise<AuthorizationResult> {
  const context = await getAuthenticatedRequestContext(event);

  if (!context) {
    return {
      context: null,
      response: unauthorized("Sign in to suggest books."),
    };
  }

  return {
    context,
    response: null,
  };
}

export async function requireCatalogModeratorContext(
  event: HttpEvent,
): Promise<AuthorizationResult> {
  const authResult = await requireAuthenticatedPrivilegedContext(event);

  if (!authResult.context) {
    return authResult;
  }

  if (!isUserInGroup(authResult.context, getCatalogModeratorGroupName())) {
    return {
      context: null,
      response: forbidden("Catalog moderation access is required for this action."),
    };
  }

  return authResult;
}
