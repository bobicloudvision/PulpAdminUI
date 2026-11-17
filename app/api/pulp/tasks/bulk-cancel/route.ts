import { pulpFetch, type PulpAuth } from "@/lib/pulp";
import { PulpTaskBulkCancelResult } from "@/services/pulp/types";
import { isUuid, pulpFailureResponse, requirePulpAuth } from "../../_helpers";
import { applyTaskFilters } from "../_filters";

const MAX_TASKS = 1000;
const CONCURRENCY = 5;
const PAGE_SIZE = 200;

type Body = {
  /** Explicit task ids to cancel. */
  ids?: unknown;
  /** Or: cancel every waiting/running task matching these filters. */
  all?: boolean;
  state?: string | null;
  name?: string | null;
  worker?: string | null;
};

function lastSegment(href: string): string {
  return href.replace(/\/+$/, "").split("/").pop() ?? "";
}

async function collectMatchingIds(auth: PulpAuth, body: Body) {
  const source = new URLSearchParams();
  if (body.name) source.set("name", body.name);
  if (body.worker) source.set("worker", body.worker);

  const ids: string[] = [];
  let truncated = false;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), fields: "pulp_href" });
    applyTaskFilters(source, qs);
    // Only cancelable states, optionally narrowed to one of them.
    if (body.state === "waiting" || body.state === "running") qs.set("state", body.state);
    else qs.set("state__in", "waiting,running");

    const page = await pulpFetch<{ next: string | null; results: { pulp_href: string }[] }>(
      `/tasks/?${qs}`,
      auth
    );
    if (!page.ok) return page;
    ids.push(...page.data.results.map((t) => lastSegment(t.pulp_href)));
    if (ids.length >= MAX_TASKS) {
      truncated = ids.length > MAX_TASKS || page.data.next !== null;
      return { ok: true as const, ids: ids.slice(0, MAX_TASKS), truncated };
    }
    if (!page.data.next || page.data.results.length === 0) {
      return { ok: true as const, ids, truncated };
    }
  }
}

/** Pulp has no bulk cancel endpoint, so tasks are canceled one by one (limited concurrency). */
export async function POST(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ detail: "Invalid request body." }, { status: 400 });
  }

  let ids: string[];
  let truncated = false;
  if (body.all) {
    const collected = await collectMatchingIds(authResult.auth, body);
    if (!collected.ok) return pulpFailureResponse(collected);
    ids = collected.ids;
    truncated = collected.truncated;
  } else if (Array.isArray(body.ids)) {
    ids = [...new Set(body.ids.filter(isUuid))].slice(0, MAX_TASKS);
    if (ids.length === 0) {
      return Response.json({ detail: "No valid task ids given." }, { status: 400 });
    }
  } else {
    return Response.json({ detail: "Provide ids or all=true." }, { status: 400 });
  }

  const auth = authResult.auth;
  const result: PulpTaskBulkCancelResult = { requested: ids.length, canceled: 0, failed: [], truncated };
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const res = await pulpFetch(`/tasks/${id}/`, auth, {
        method: "PATCH",
        body: JSON.stringify({ state: "canceled" }),
      });
      if (res.ok) result.canceled += 1;
      // 409: the task already finished in the meantime — not worth reporting as a failure.
      else if (res.status !== 409) result.failed.push({ id, detail: res.detail });
      else result.requested -= 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

  return Response.json(result);
}
