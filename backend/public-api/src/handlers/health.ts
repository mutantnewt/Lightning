import { ok, type HttpResponse } from "../../../shared/http";

export function healthHandler(): HttpResponse {
  return ok({
    ok: true,
    surface: "public-api",
    status: "scaffolded",
  });
}
