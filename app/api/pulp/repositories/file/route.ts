import { cookies } from "next/headers";
import { getPulpApiUrl, PULP_AUTH_COOKIE, pulpFetch, toBasicAuthHeader } from "@/lib/pulp";
import { requirePulpAuth } from "@/app/api/pulp/_helpers";
import {
  authHeaders,
  normalizePulpHrefToApiPath,
  readDetail,
  TaskRefResponse,
  waitForTask,
} from "../_server";

type PulpFileRepositoryRow = {
  name: string;
  pulp_href: string;
};

type PulpFileRepositoryListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: PulpFileRepositoryRow[];
};

type DeleteBody = {
  pulp_href?: string;
};

type FilePatchBody = {
  pulp_href?: string;
  name?: string;
  description?: string | null;
  retain_repo_versions?: number | null;
  remote?: string | null;
  autopublish?: boolean;
  manifest?: string | null;
};

function nullIfBlank(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function toRetainRepoVersions(v: number | null | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function buildFilePatchPayload(body: FilePatchBody, name: string): Record<string, unknown> {
  return {
    name: name.trim(),
    description:
      body.description === undefined || body.description === null || body.description === ""
        ? null
        : String(body.description),
    retain_repo_versions: toRetainRepoVersions(body.retain_repo_versions),
    remote: nullIfBlank(body.remote ?? null),
    autopublish: Boolean(body.autopublish),
    manifest: nullIfBlank(body.manifest ?? null),
  };
}

function isFileRepositoryApiPath(path: string): boolean {
  return path.includes("/repositories/file/file/");
}

export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const limit = url.searchParams.get("limit") ?? "200";
  const offset = url.searchParams.get("offset") ?? "0";

  const result = await pulpFetch<PulpFileRepositoryListResponse>(
    `/repositories/file/file/?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    authResult.auth
  );

  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }

    return Response.json({ detail: result.detail }, { status: result.status });
  }

  return Response.json(result.data);
}

export async function PATCH(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = (await request.json()) as FilePatchBody;
  const pulpHref = body.pulp_href?.trim();
  const name = body.name?.trim();
  if (!pulpHref) {
    return Response.json({ detail: "pulp_href is required." }, { status: 400 });
  }
  if (!name) {
    return Response.json({ detail: "Repository name is required." }, { status: 400 });
  }

  const apiPath = normalizePulpHrefToApiPath(pulpHref);
  if (!isFileRepositoryApiPath(apiPath)) {
    return Response.json({ detail: "Not a File repository href." }, { status: 400 });
  }

  const authHeader = toBasicAuthHeader(authResult.auth);
  const headers = authHeaders(authHeader);
  headers.set("Content-Type", "application/json");

  const patchPayload = buildFilePatchPayload(body, name);

  const patchResponse = await fetch(getPulpApiUrl(apiPath), {
    method: "PATCH",
    headers,
    body: JSON.stringify(patchPayload),
    cache: "no-store",
  });

  if (patchResponse.status === 202) {
    const ct = patchResponse.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try {
        const raw = await patchResponse.text();
        if (raw) {
          const payload = JSON.parse(raw) as TaskRefResponse;
          if (payload.task) {
            try {
              await waitForTask(payload.task, authHeader);
            } catch (error) {
              return Response.json(
                { detail: error instanceof Error ? error.message : "Repository update task failed." },
                { status: 500 }
              );
            }
          }
        }
      } catch {
        // Empty or non-JSON 202 body — treat as accepted.
      }
    }
    return Response.json({ ok: true, name });
  }

  if (patchResponse.ok) {
    const ct = patchResponse.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const updated = (await patchResponse.json()) as { name?: string };
      return Response.json({ ok: true, name: typeof updated.name === "string" ? updated.name : name });
    }
    return Response.json({ ok: true, name });
  }

  if (patchResponse.status === 401 || patchResponse.status === 403) {
    const cookieStore = await cookies();
    cookieStore.delete(PULP_AUTH_COOKIE);
  }
  return Response.json({ detail: await readDetail(patchResponse) }, { status: patchResponse.status });
}

export async function DELETE(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = (await request.json()) as DeleteBody;
  const pulpHref = body.pulp_href?.trim();
  if (!pulpHref) {
    return Response.json({ detail: "pulp_href is required." }, { status: 400 });
  }

  const authHeader = toBasicAuthHeader(authResult.auth);
  const apiPath = normalizePulpHrefToApiPath(pulpHref);
  const deleteResponse = await fetch(getPulpApiUrl(apiPath), {
    method: "DELETE",
    headers: authHeaders(authHeader),
    cache: "no-store",
  });

  if (deleteResponse.status === 204 || deleteResponse.status === 202) {
    if (deleteResponse.status === 202) {
      const ct = deleteResponse.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const payload = (await deleteResponse.json()) as TaskRefResponse;
        if (payload.task) {
          await waitForTask(payload.task, authHeader);
        }
      }
    }
    return Response.json({ ok: true });
  }

  if (!deleteResponse.ok) {
    if (deleteResponse.status === 401 || deleteResponse.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }
    return Response.json({ detail: await readDetail(deleteResponse) }, { status: deleteResponse.status });
  }

  const ct = deleteResponse.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const payload = (await deleteResponse.json()) as TaskRefResponse;
    if (payload.task) {
      await waitForTask(payload.task, authHeader);
    }
  }

  return Response.json({ ok: true });
}
