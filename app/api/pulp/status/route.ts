import { pulpFetch } from "@/lib/pulp";
import { PulpStatus } from "@/services/pulp/types";
import { pulpFailureResponse, requirePulpAuth } from "../_helpers";

export async function GET() {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const result = await pulpFetch<PulpStatus>("/status/", authResult.auth);
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json(result.data);
}
