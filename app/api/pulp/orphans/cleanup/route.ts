import { cookies } from "next/headers";
import { getPulpApiUrl, PULP_AUTH_COOKIE, toBasicAuthHeader } from "@/lib/pulp";
import { requirePulpAuth } from "@/app/api/pulp/_helpers";
import { authHeaders, readDetail, waitForTask } from "../../repositories/_server";

type CleanupBody = {
  orphan_protection_time?: number | null;
};

export async function POST(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = (await request.json().catch(() => ({}))) as CleanupBody;

  const authHeader = toBasicAuthHeader(authResult.auth);
  const headers = authHeaders(authHeader);
  headers.set("Content-Type", "application/json");

  const payload: Record<string, unknown> = {};
  if (typeof body.orphan_protection_time === "number" && Number.isFinite(body.orphan_protection_time)) {
    payload.orphan_protection_time = body.orphan_protection_time;
  }

  const cleanupResponse = await fetch(getPulpApiUrl("/orphans/cleanup/"), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!cleanupResponse.ok) {
    if (cleanupResponse.status === 401 || cleanupResponse.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }
    return Response.json({ detail: await readDetail(cleanupResponse) }, { status: cleanupResponse.status });
  }

  const { task } = (await cleanupResponse.json()) as { task: string };

  try {
    const finished = await waitForTask(task, authHeader);
    return Response.json({
      task,
      state: finished.state ?? "completed",
      progress_reports: finished.progress_reports ?? [],
    });
  } catch (error) {
    return Response.json(
      { detail: error instanceof Error ? error.message : "Orphan cleanup task failed." },
      { status: 500 }
    );
  }
}
