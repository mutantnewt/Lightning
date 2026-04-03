import { ok, serverError, type HttpResponse } from "../../../shared/http";
import { listFaqEntries } from "../services/catalogService";

export async function getFaqHandler(): Promise<HttpResponse> {
  try {
    const faqEntries = await listFaqEntries();
    return ok({ faqEntries });
  } catch (error) {
    console.error("Error loading FAQ entries:", error);
    return serverError("Unable to load FAQ entries.");
  }
}
