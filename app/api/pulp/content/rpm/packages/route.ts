import { cookies } from "next/headers";
import {
  getPulpApiUrl,
  getPulpBaseUrl,
  PULP_AUTH_COOKIE,
  toBasicAuthHeader,
} from "@/lib/pulp";
import { pulpFailureResponse, requirePulpAuth } from "@/app/api/pulp/_helpers";
import { searchRpmPackages } from "./_search";

type CreateRpmRequestBody = {
  artifact?: string;
};

type CreateRpmResponse = {
  task?: string;
  pulp_href?: string;
  href?: string;
};

type TaskResponse = {
  state?: string;
  error?: unknown;
  created_resources?: string[];
  pulp_href?: string;
  href?: string;
};

type ExistingRpmPackage = {
  pulp_href?: string;
  href?: string;
  sha256?: string;
  pkgId?: string;
};

type ExistingRpmPackageResponse = {
  results?: ExistingRpmPackage[];
};

type DuplicatePackageInfo = {
  pkgId?: string;
  name?: string;
  version?: string;
  release?: string;
  arch?: string;
};

async function readDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (typeof payload.detail === "string" && payload.detail.length > 0) {
      return payload.detail;
    }
  } catch {
    // Ignore parsing failure.
  }

  return response.statusText || `Pulp request failed with status ${response.status}.`;
}

function authHeaders(authHeader: string): Headers {
  const headers = new Headers();
  headers.set("Authorization", authHeader);
  headers.set("Accept", "application/json");
  return headers;
}

function normalizePulpHrefToApiPath(href: string): string {
  const rawPath = href.startsWith("http://") || href.startsWith("https://") ? new URL(href).pathname : href;
  const normalizedRawPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  const baseUrlPath = new URL(getPulpBaseUrl()).pathname.replace(/\/+$/, "");
  if (baseUrlPath && normalizedRawPath.startsWith(baseUrlPath)) {
    const withoutBase = normalizedRawPath.slice(baseUrlPath.length);
    return withoutBase.startsWith("/") ? withoutBase : `/${withoutBase}`;
  }

  return normalizedRawPath;
}

function toAbsoluteArtifactUrl(artifact: string): string {
  if (artifact.startsWith("http://") || artifact.startsWith("https://")) {
    return artifact;
  }

  const origin = new URL(getPulpBaseUrl()).origin;
  const normalized = artifact.startsWith("/") ? artifact : `/${artifact}`;
  return `${origin}${normalized}`;
}

async function waitForTask(taskHref: string, authHeader: string): Promise<TaskResponse> {
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

function parseDuplicatePackageInfo(errorText: string): DuplicatePackageInfo | null {
  if (!errorText.includes("already a package with")) {
    return null;
  }

  const pkgId = errorText.match(/pkgId=([a-f0-9]{64})/i)?.[1];
  const name = errorText.match(/name=([^,]+)/)?.[1]?.trim();
  const version = errorText.match(/version=([^,]+)/)?.[1]?.trim();
  const release = errorText.match(/release=([^,]+)/)?.[1]?.trim();
  const arch = errorText.match(/arch=([^,]+)/)?.[1]?.trim();

  if (!pkgId && !name) {
    return null;
  }

  return { pkgId, name, version, release, arch };
}

async function findExistingRpmContent(
  authHeader: string,
  info: DuplicatePackageInfo
): Promise<string | null> {
  async function fetchFirst(query: string): Promise<string | null> {
    const response = await fetch(getPulpApiUrl(`/content/rpm/packages/?${query}`), {
      method: "GET",
      headers: authHeaders(authHeader),
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ExistingRpmPackageResponse;
    const first = payload.results?.[0];
    return first?.pulp_href ?? first?.href ?? null;
  }

  if (info.pkgId) {
    const bySha = await fetchFirst(`sha256=${encodeURIComponent(info.pkgId)}`);
    if (bySha) return bySha;
  }

  const queryParams: string[] = [];
  if (info.name) queryParams.push(`name=${encodeURIComponent(info.name)}`);
  if (info.version) queryParams.push(`version=${encodeURIComponent(info.version)}`);
  if (info.release) queryParams.push(`release=${encodeURIComponent(info.release)}`);
  if (info.arch) queryParams.push(`arch=${encodeURIComponent(info.arch)}`);

  if (queryParams.length === 0) {
    return null;
  }

  return fetchFirst(queryParams.join("&"));
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Searches RPM packages. Query: ?search=<text>&limit=&offset=
 * A 64-char hex value matches sha256 exactly; anything else matches package names (see ./_search).
 */
export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  if (!search) {
    return Response.json({ detail: "Search text is required." }, { status: 400 });
  }

  const result = await searchRpmPackages(
    authResult.auth,
    search,
    clampInt(url.searchParams.get("limit"), 20, 1, 200),
    clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER)
  );
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json(result.data);
}

export async function POST(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = (await request.json()) as CreateRpmRequestBody;
  const artifact = body.artifact?.trim();
  if (!artifact) {
    return Response.json({ detail: "Artifact is required." }, { status: 400 });
  }

  const authHeader = toBasicAuthHeader(authResult.auth);
  const headers = authHeaders(authHeader);
  headers.set("Content-Type", "application/json");

  const createResponse = await fetch(getPulpApiUrl("/content/rpm/packages/"), {
    method: "POST",
    headers,
    body: JSON.stringify({ artifact: toAbsoluteArtifactUrl(artifact) }),
    cache: "no-store",
  });

  if (!createResponse.ok) {
    if (createResponse.status === 401 || createResponse.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }

    return Response.json({ detail: await readDetail(createResponse) }, { status: createResponse.status });
  }

  const created = (await createResponse.json()) as CreateRpmResponse;
  let content = created.pulp_href ?? created.href ?? null;

  if (created.task) {
    try {
      const task = await waitForTask(created.task, authHeader);
      content = task.created_resources?.[0] ?? task.pulp_href ?? task.href ?? content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duplicateInfo = parseDuplicatePackageInfo(errorMessage);

      if (!duplicateInfo) {
        throw error;
      }

      const existingContent = await findExistingRpmContent(authHeader, duplicateInfo);
      if (!existingContent) {
        throw error;
      }

      content = existingContent;
    }
  }

  return Response.json({
    content,
    task: created.task ?? null,
  });
}
