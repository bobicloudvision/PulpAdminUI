import { readApiDetail } from "./http";
import {
  PulpPaginatedResponse,
  PulpTask,
  PulpTaskBulkCancelResult,
  PulpTaskCounts,
  PulpTaskFilters,
  ServiceResult,
} from "./types";
import { API_BASE } from "@/lib/base-path";

const TASKS_PATH = `${API_BASE}/tasks`;

function filterParams(filters: PulpTaskFilters | undefined, into: URLSearchParams): URLSearchParams {
  if (filters?.state) into.set("state", filters.state);
  if (filters?.name?.trim()) into.set("name", filters.name.trim());
  if (filters?.worker) into.set("worker", filters.worker);
  return into;
}

async function mutation(response: Response): Promise<ServiceResult> {
  if (!response.ok) {
    return { ok: false, detail: await readApiDetail(response) };
  }
  return { ok: true };
}

export const pulpTaskService = {
  async list(params: {
    limit: number;
    offset: number;
    filters?: PulpTaskFilters;
  }): Promise<PulpPaginatedResponse<PulpTask>> {
    const qs = filterParams(
      params.filters,
      new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) })
    );
    const response = await fetch(`${TASKS_PATH}?${qs}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpPaginatedResponse<PulpTask>;
  },

  /** Per-state counts for the given name/worker filters (state filter is ignored). */
  async counts(filters?: PulpTaskFilters): Promise<PulpTaskCounts> {
    const qs = filterParams({ ...filters, state: null }, new URLSearchParams());
    const response = await fetch(`${TASKS_PATH}/counts?${qs}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }
    return (await response.json()) as PulpTaskCounts;
  },

  async get(id: string): Promise<PulpTask> {
    const response = await fetch(`${TASKS_PATH}/${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }
    return (await response.json()) as PulpTask;
  },

  async cancel(id: string): Promise<ServiceResult> {
    return mutation(await fetch(`${TASKS_PATH}/${encodeURIComponent(id)}`, { method: "PATCH" }));
  },

  /** Cancels the given tasks, or (with `all`) every waiting/running task matching `filters`. */
  async bulkCancel(
    target: { ids: string[] } | { all: true; filters: PulpTaskFilters }
  ): Promise<PulpTaskBulkCancelResult> {
    const body = "ids" in target ? { ids: target.ids } : { all: true, ...target.filters };
    const response = await fetch(`${TASKS_PATH}/bulk-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }
    return (await response.json()) as PulpTaskBulkCancelResult;
  },

  /** Starts Pulp's purge of finished task records; returns the purge task href. */
  async purge(finishedBefore: Date, states: string[]): Promise<{ ok: true; task: string } | { ok: false; detail: string }> {
    const response = await fetch(`${TASKS_PATH}/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finished_before: finishedBefore.toISOString(), states }),
    });
    if (!response.ok) {
      return { ok: false, detail: await readApiDetail(response) };
    }
    const payload = (await response.json()) as { task: string };
    return { ok: true, task: payload.task };
  },

  async remove(id: string): Promise<ServiceResult> {
    return mutation(await fetch(`${TASKS_PATH}/${encodeURIComponent(id)}`, { method: "DELETE" }));
  },
};
