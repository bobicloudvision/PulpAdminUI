import { pulpFetch } from "@/lib/pulp";
import { pulpFailureResponse, requirePulpAuth } from "../../_helpers";

const PURGEABLE_STATES = ["completed", "failed", "canceled", "skipped"];

/**
 * Starts Pulp's task purge (deletes finished task records). Body: { finished_before: ISO date, states: string[] }.
 * Returns { task } — the href of the async purge task.
 */
export async function POST(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  let body: { finished_before?: unknown; states?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ detail: "Invalid request body." }, { status: 400 });
  }

  const finishedBefore = typeof body.finished_before === "string" ? new Date(body.finished_before) : null;
  if (!finishedBefore || Number.isNaN(finishedBefore.getTime())) {
    return Response.json({ detail: "finished_before must be a valid date." }, { status: 400 });
  }
  const states = Array.isArray(body.states)
    ? body.states.filter((s): s is string => typeof s === "string" && PURGEABLE_STATES.includes(s))
    : [];
  if (states.length === 0) {
    return Response.json({ detail: "Select at least one state to purge." }, { status: 400 });
  }

  const result = await pulpFetch<{ task: string }>("/tasks/purge/", authResult.auth, {
    method: "POST",
    body: JSON.stringify({ finished_before: finishedBefore.toISOString(), states }),
  });
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json(result.data, { status: 202 });
}
