import { getAuthenticatedUser } from "../../../shared/auth";
import {
  ok,
  unauthorized,
  type HttpEvent,
  type HttpResponse,
} from "../../../shared/http";

export async function getMeHandler(
  event: HttpEvent,
): Promise<HttpResponse> {
  const user = await getAuthenticatedUser(event);

  if (!user) {
    return unauthorized();
  }

  return ok({ user });
}
