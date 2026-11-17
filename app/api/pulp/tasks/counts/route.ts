import { pulpFetch } from "@/lib/pulp";
import { PULP_TASK_STATES, PulpTaskCounts } from "@/services/pulp/types";
import { pulpFailureResponse, requirePulpAuth } from "../../_helpers";
import { applyTaskFilters } from "../_filters";

/** Number of tasks per state, honoring the same name/worker filters as the list. */
export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const source = new URL(request.url).searchParams;
  source.delete("state");

  const results = await Promise.all(
    PULP_TASK_STATES.map(async (state) => {
      const qs = new URLSearchParams({ state, limit: "1", fields: "pulp_href" });
      applyTaskFilters(source, qs);
      const result = await pulpFetch<{ count: number }>(`/tasks/?${qs}`, authResult.auth);
      return [state, result] as const;
    })
  );

  const counts: PulpTaskCounts = {};
  for (const [state, result] of results) {
    if (!result.ok) {
      return pulpFailureResponse(result);
    }
    counts[state] = result.data.count;
  }

  return Response.json(counts);
}
