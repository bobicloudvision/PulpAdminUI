import { PULP_TASK_STATES, PulpTaskState } from "@/services/pulp/types";

function isTaskState(value: string | null): value is PulpTaskState {
  return value !== null && (PULP_TASK_STATES as readonly string[]).includes(value);
}

/**
 * Copies the supported task filters from an incoming request to a Pulp query string.
 * pulpcore 3.22 supports: state, name__contains, worker (href).
 */
export function applyTaskFilters(source: URLSearchParams, target: URLSearchParams): void {
  const state = source.get("state");
  if (isTaskState(state)) {
    target.set("state", state);
  }

  const name = source.get("name")?.trim();
  if (name) {
    target.set("name__contains", name);
  }

  const worker = source.get("worker")?.trim();
  // Worker filter takes the worker's pulp_href; only accept a path to avoid arbitrary URLs.
  if (worker && /^\/[\w\-./]+\/workers\/[0-9a-f-]+\/$/i.test(worker)) {
    target.set("worker", worker);
  }
}
