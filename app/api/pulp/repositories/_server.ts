import { getPulpApiUrl, getPulpBaseUrl } from "@/lib/pulp";
import type { PulpTaskProgressReport } from "@/services/pulp/types";

export type CreatedResourceEntry = string | { pulp_href?: string; href?: string };

export type TaskResponse = {
  state?: string;
  error?: unknown;
  created_resources?: CreatedResourceEntry[];
  pulp_href?: string;
  href?: string;
  progress_reports?: PulpTaskProgressReport[];
};

export function hrefFromCreatedResource(entry: CreatedResourceEntry | undefined): string | null {
  if (entry == null) return null;
  if (typeof entry === "string") return entry;
  const h = entry.pulp_href ?? entry.href;
  return typeof h === "string" ? h : null;
}

/** Pulp may return created_resources as strings or nested objects; publication may not be index 0. */
export function resolvePublicationHrefAfterTask(task: TaskResponse, fallback: string | null): string | null {
  const resources = task.created_resources;
  if (resources?.length) {
    for (const r of resources) {
      const h = hrefFromCreatedResource(r);
      if (h && h.includes("/publications/")) {
        return h;
      }
    }
    const first = hrefFromCreatedResource(resources[0]);
    if (first) {
      return first;
    }
  }
  if (typeof task.pulp_href === "string" && task.pulp_href.includes("/publications/")) {
    return task.pulp_href;
  }
  if (typeof task.href === "string" && task.href.includes("/publications/")) {
    return task.href;
  }
  return fallback;
}

export type TaskRefResponse = {
  task?: string;
  pulp_href?: string;
  href?: string;
};

export type PulpPaginatedJson<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function formatPulpErrorPayload(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  if (typeof o.detail === "string" && o.detail.length > 0) {
    return o.detail;
  }
  if (Array.isArray(o.detail) && o.detail.length > 0) {
    return o.detail.map(String).join("; ");
  }
  const parts: string[] = [];
  for (const [key, val] of Object.entries(o)) {
    if (key === "detail") continue;
    if (Array.isArray(val)) {
      const msgs = val.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
      if (msgs.length > 0) parts.push(`${key}: ${msgs.join(", ")}`);
    } else if (typeof val === "string") {
      parts.push(`${key}: ${val}`);
    } else if (val != null && typeof val === "object") {
      parts.push(`${key}: ${JSON.stringify(val)}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

export async function readDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (text.trim().length === 0) {
      return response.statusText || `Pulp request failed with status ${response.status}.`;
    }
    const payload = JSON.parse(text) as unknown;
    const formatted = formatPulpErrorPayload(payload);
    if (formatted) {
      return formatted;
    }
  } catch {
    // Ignore parsing failure.
  }

  return response.statusText || `Pulp request failed with status ${response.status}.`;
}

export function getBaseApiPath(): string {
  return new URL(getPulpBaseUrl()).pathname.replace(/\/+$/, "");
}

export function normalizePulpHrefToApiPath(href: string): string {
  const rawPath = href.startsWith("http://") || href.startsWith("https://") ? new URL(href).pathname : href;
  const normalizedRawPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const baseApiPath = getBaseApiPath();

  if (baseApiPath && normalizedRawPath.startsWith(baseApiPath)) {
    const withoutBase = normalizedRawPath.slice(baseApiPath.length);
    return withoutBase.startsWith("/") ? withoutBase : `/${withoutBase}`;
  }

  return normalizedRawPath;
}

export function toPulpHrefPath(href: string): string {
  const rawPath = href.startsWith("http://") || href.startsWith("https://") ? new URL(href).pathname : href;
  const normalizedRawPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const baseApiPath = getBaseApiPath();

  if (baseApiPath && normalizedRawPath.startsWith(baseApiPath)) {
    return normalizedRawPath;
  }

  return `${baseApiPath}${normalizedRawPath}`;
}

export function authHeaders(authHeader: string): Headers {
  const headers = new Headers();
  headers.set("Authorization", authHeader);
  headers.set("Accept", "application/json");
  return headers;
}

export function extractNextApiPath(next: string | null): string | null {
  if (!next) return null;
  const hrefMatch = next.match(/href="([^"]+)"/i);
  const normalized = hrefMatch?.[1] ?? next;
  try {
    const url = new URL(normalized);
    return normalizePulpHrefToApiPath(url.pathname + url.search);
  } catch {
    return normalizePulpHrefToApiPath(normalized);
  }
}

export async function waitForTask(taskHref: string, authHeader: string): Promise<TaskResponse> {
  const maxAttempts = 60;
  const taskPath = normalizePulpHrefToApiPath(taskHref);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const taskResponse = await fetch(getPulpApiUrl(taskPath), {
      method: "GET",
      headers: authHeaders(authHeader),
      cache: "no-store",
    });
    if (!taskResponse.ok) {
      throw new Error(await readDetail(taskResponse));
    }

    const task = (await taskResponse.json()) as TaskResponse;
    if (task.state === "completed") {
      return task;
    }

    if (task.state === "failed" || task.state === "canceled") {
      const serializedError =
        typeof task.error === "string" ? task.error : JSON.stringify(task.error ?? "Task failed");
      throw new Error(serializedError);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Task did not complete within timeout period.");
}
