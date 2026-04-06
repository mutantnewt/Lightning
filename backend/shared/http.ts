import { AsyncLocalStorage } from "node:async_hooks";

export interface HttpEvent {
  rawPath?: string;
  path?: string;
  httpMethod?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  pathParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  requestContext?: {
    http?: {
      method?: string;
    };
    authorizer?: {
      jwt?: {
        claims?: Record<string, unknown>;
      };
    };
  };
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const httpEventContext = new AsyncLocalStorage<HttpEvent>();

function getConfiguredCorsOrigins(): string[] {
  const multiOriginValue = process.env.CORS_ALLOW_ORIGINS?.trim();

  if (multiOriginValue) {
    return multiOriginValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const singleOriginValue = process.env.CORS_ALLOW_ORIGIN?.trim();
  return singleOriginValue ? [singleOriginValue] : ["*"];
}

function getHeaderValue(
  headers: Record<string, string | undefined> | undefined,
  key: string,
): string | null {
  if (!headers) {
    return null;
  }

  const directValue = headers[key];

  if (typeof directValue === "string" && directValue.trim()) {
    return directValue.trim();
  }

  const normalizedKey = key.toLowerCase();

  for (const [headerKey, headerValue] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === normalizedKey && headerValue?.trim()) {
      return headerValue.trim();
    }
  }

  return null;
}

function resolveCorsOrigin(): string {
  const configuredOrigins = getConfiguredCorsOrigins();

  if (configuredOrigins.includes("*")) {
    return "*";
  }

  const requestOrigin = getHeaderValue(
    httpEventContext.getStore()?.headers,
    "origin",
  );

  if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return configuredOrigins[0] ?? "*";
}

function getDefaultHeaders(): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": resolveCorsOrigin(),
    vary: "origin",
  };
}

export function withHttpEventContext<T>(
  event: HttpEvent,
  handler: () => T,
): T {
  return httpEventContext.run(event, handler);
}

export function getRequestPath(event: HttpEvent): string {
  return event.rawPath ?? event.path ?? "/";
}

export function getRequestMethod(event: HttpEvent): string {
  return event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
}

export function getQueryStringParameter(
  event: HttpEvent,
  key: string,
): string | null {
  const value = event.queryStringParameters?.[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function jsonResponse(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpResponse {
  return {
    statusCode,
    headers: {
      ...getDefaultHeaders(),
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function ok(body: unknown): HttpResponse {
  return jsonResponse(200, body);
}

export function noContent(
  headers: Record<string, string> = {},
): HttpResponse {
  return {
    statusCode: 204,
    headers: {
      ...getDefaultHeaders(),
      ...headers,
    },
    body: "",
  };
}

export function badRequest(message: string): HttpResponse {
  return jsonResponse(400, { error: message });
}

export function unauthorized(message = "Authentication required"): HttpResponse {
  return jsonResponse(401, { error: message });
}

export function forbidden(message = "Forbidden"): HttpResponse {
  return jsonResponse(403, { error: message });
}

export function conflict(message: string): HttpResponse {
  return jsonResponse(409, { error: message });
}

export function notFound(message = "Route not found"): HttpResponse {
  return jsonResponse(404, { error: message });
}

export function methodNotAllowed(allowedMethods: string[]): HttpResponse {
  return jsonResponse(
    405,
    { error: `Method not allowed. Allowed methods: ${allowedMethods.join(", ")}` },
    { allow: allowedMethods.join(", ") },
  );
}

export function notImplemented(message: string): HttpResponse {
  return jsonResponse(501, { error: message });
}

export function serverError(message = "Internal server error"): HttpResponse {
  return jsonResponse(500, { error: message });
}

export function parseJsonBody<T>(event: HttpEvent): T | null {
  if (!event.body) {
    return null;
  }

  try {
    return JSON.parse(event.body) as T;
  } catch {
    return null;
  }
}

export function corsPreflight(allowedMethods: string[]): HttpResponse {
  return noContent({
    allow: allowedMethods.join(", "),
    "access-control-allow-methods": allowedMethods.join(", "),
    "access-control-allow-headers": [
      "authorization",
      "content-type",
      "x-lightning-local-user-id",
      "x-lightning-local-user-email",
      "x-lightning-local-user-name",
      "x-lightning-local-username",
      "x-lightning-local-user-groups",
    ].join(", "),
    "access-control-max-age": "86400",
  });
}
