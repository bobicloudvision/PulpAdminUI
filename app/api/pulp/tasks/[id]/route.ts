import { pulpFetch } from "@/lib/pulp";
import { PulpTask } from "@/services/pulp/types";
import { isUuid, pulpFailureResponse, requirePulpAuth } from "../../_helpers";

type Params = { params: Promise<{ id: string }> };

async function resolve(params: Params["params"]) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return { error: authResult.response } as const;
  }
  const { id } = await params;
  if (!isUuid(id)) {
    return { error: Response.json({ detail: "Valid task id is required." }, { status: 400 }) } as const;
  }
  return { auth: authResult.auth, id } as const;
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = await resolve(params);
  if ("error" in ctx) return ctx.error;

  const result = await pulpFetch<PulpTask>(`/tasks/${ctx.id}/`, ctx.auth);
  if (!result.ok) return pulpFailureResponse(result);
  return Response.json(result.data);
}

/** Cancels a waiting/running task. */
export async function PATCH(_request: Request, { params }: Params) {
  const ctx = await resolve(params);
  if ("error" in ctx) return ctx.error;

  const result = await pulpFetch<PulpTask>(`/tasks/${ctx.id}/`, ctx.auth, {
    method: "PATCH",
    body: JSON.stringify({ state: "canceled" }),
  });
  if (!result.ok) return pulpFailureResponse(result);
  return Response.json(result.data);
}

/** Deletes a finished task record. */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await resolve(params);
  if ("error" in ctx) return ctx.error;

  const result = await pulpFetch(`/tasks/${ctx.id}/`, ctx.auth, { method: "DELETE" });
  if (!result.ok) return pulpFailureResponse(result);
  return Response.json({ ok: true });
}
