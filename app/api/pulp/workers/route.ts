import { pulpFetch } from "@/lib/pulp";
import { PulpTask, PulpWorker } from "@/services/pulp/types";
import { isUuid, pulpFailureResponse, requirePulpAuth } from "../_helpers";

type PulpListResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function lastSegment(href: string): string {
  return href.replace(/\/+$/, "").split("/").pop() ?? "";
}

/**
 * Lists workers. Query: ?scope=online (default) | all | missing.
 * Busy workers get `current_task_detail` (name/state/started_at) so the UI can show what they run.
 */
export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const scope = new URL(request.url).searchParams.get("scope") ?? "online";
  const qs = new URLSearchParams({ limit: "200", ordering: "name" });
  if (scope === "online") {
    qs.set("online", "true");
  } else if (scope === "missing") {
    qs.set("missing", "true");
  }

  const result = await pulpFetch<PulpListResponse<PulpWorker>>(`/workers/?${qs}`, authResult.auth);
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  const workers = await Promise.all(
    result.data.results.map(async (worker) => {
      const taskId = worker.current_task ? lastSegment(worker.current_task) : "";
      if (!isUuid(taskId)) {
        return { ...worker, current_task_detail: null };
      }
      const qsTask = new URLSearchParams();
      for (const field of ["name", "state", "started_at"]) qsTask.append("fields", field);
      const task = await pulpFetch<Pick<PulpTask, "name" | "state" | "started_at">>(
        `/tasks/${taskId}/?${qsTask}`,
        authResult.auth
      );
      return { ...worker, current_task_detail: task.ok ? task.data : null };
    })
  );

  return Response.json({ ...result.data, results: workers });
}
