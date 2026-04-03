import { createServer } from "node:http";
import { handler as authHandler } from "./auth-api/src/index";
import { handler as privilegedHandler } from "./privileged-api/src/index";
import { handler as publicHandler } from "./public-api/src/index";
import { jsonResponse, type HttpEvent, type HttpResponse } from "./shared/http";
import { loadBackendEnv } from "./shared/loadLocalEnv";

loadBackendEnv();
process.env.ALLOW_LOCAL_AUTH_HEADERS ??= "true";

const port = Number(process.env.PORT ?? "8787");
const host = process.env.HOST ?? "127.0.0.1";

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

function toHttpEvent(
  req: import("node:http").IncomingMessage,
  rawBody: string,
): HttpEvent {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

  return {
    rawPath: url.pathname,
    path: url.pathname,
    httpMethod: req.method ?? "GET",
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value,
      ]),
    ),
    queryStringParameters:
      url.searchParams.size > 0
        ? Object.fromEntries(url.searchParams.entries())
        : null,
    body: rawBody || null,
    requestContext: {
      http: {
        method: req.method ?? "GET",
      },
    },
  };
}

function writeResponse(
  res: import("node:http").ServerResponse,
  response: HttpResponse,
): void {
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
}

async function routeEvent(event: HttpEvent): Promise<HttpResponse> {
  const path = event.rawPath ?? event.path ?? "/";

  if (path.startsWith("/auth/")) {
    return authHandler(event);
  }

  if (path.startsWith("/public/")) {
    return publicHandler(event);
  }

  if (path.startsWith("/privileged/")) {
    return privilegedHandler(event);
  }

  if (path === "/health") {
    return jsonResponse(200, {
      service: "lightning-local-dev-server",
      status: "ok",
      authBasePath: "/auth",
      publicBasePath: "/public",
      privilegedBasePath: "/privileged",
    });
  }

  return jsonResponse(404, {
    error: `No local route registered for ${path}`,
  });
}

const server = createServer(async (req, res) => {
  try {
    const body = await readBody(req);
    const event = toHttpEvent(req, body);
    const response = await routeEvent(event);
    writeResponse(res, response);
  } catch (error) {
    console.error("Local dev server error:", error);
    writeResponse(
      res,
      jsonResponse(500, { error: "Local dev server failed to process the request." }),
    );
  }
});

server.listen(port, host, () => {
  console.log(`Lightning local backend listening on http://${host}:${port}`);
});
