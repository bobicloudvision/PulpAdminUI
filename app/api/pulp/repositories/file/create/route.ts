import { cookies } from "next/headers";
import { getPulpApiUrl, PULP_AUTH_COOKIE, toBasicAuthHeader } from "@/lib/pulp";
import { requirePulpAuth } from "@/app/api/pulp/_helpers";
import type { FileRepositoryCreatePayload } from "@/services/pulp/types";
import { authHeaders, hrefFromCreatedResource, readDetail, TaskRefResponse, waitForTask } from "../../_server";

function trimOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t;
}

function parseLabels(value: unknown): Record<string, string> | null {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "string") return null;
    out[k] = v;
  }
  return out;
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const raw = (await request.json()) as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    return Response.json({ detail: "Repository name is required." }, { status: 400 });
  }

  const labels = parseLabels(raw.pulp_labels);
  if (labels === null) {
    return Response.json({ detail: "pulp_labels must be a JSON object with string values." }, { status: 400 });
  }

  const description = typeof raw.description === "string" ? raw.description : "";
  const payload: FileRepositoryCreatePayload = {
    pulp_labels: labels,
    name,
    description,
    retain_repo_versions: parseNullableInt(raw.retain_repo_versions),
    remote: trimOrNull(raw.remote),
    autopublish: Boolean(raw.autopublish),
    manifest: trimOrNull(raw.manifest),
  };

  const authHeader = toBasicAuthHeader(authResult.auth);
  const headers = authHeaders(authHeader);
  headers.set("Content-Type", "application/json");

  const createResponse = await fetch(getPulpApiUrl("/repositories/file/file/"), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!createResponse.ok) {
    if (createResponse.status === 401 || createResponse.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }
    return Response.json({ detail: await readDetail(createResponse) }, { status: createResponse.status });
  }

  const created = (await createResponse.json()) as TaskRefResponse;
  let pulpHref = created.pulp_href ?? created.href ?? null;

  try {
    if (created.task) {
      const task = await waitForTask(created.task, authHeader);
      pulpHref = hrefFromCreatedResource(task.created_resources?.[0]) ?? pulpHref;
    }
  } catch (error) {
    return Response.json(
      { detail: error instanceof Error ? error.message : "Repository creation task failed." },
      { status: 500 }
    );
  }

  return Response.json({
    name: payload.name,
    pulp_href: pulpHref,
    task: created.task ?? null,
  });
}
