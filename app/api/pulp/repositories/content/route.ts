import { cookies } from "next/headers";
import { PULP_AUTH_COOKIE, pulpFetch } from "@/lib/pulp";
import { requirePulpAuth } from "@/app/api/pulp/_helpers";
import { extractNextApiPath, normalizePulpHrefToApiPath, PulpPaginatedJson } from "../_server";

type ContentRow = Record<string, unknown>;

const RPM_PACKAGE_FIELDS = "pulp_href,pulp_created,name,epoch,version,release,arch,size_package";

function isRpmRepositoryPath(path: string): boolean {
  return path.includes("/repositories/rpm/rpm/");
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

async function loadAllPages(
  firstPath: string,
  auth: Parameters<typeof pulpFetch>[1]
): Promise<{ ok: true; rows: ContentRow[] } | { ok: false; status: number; detail: string }> {
  const allResults: ContentRow[] = [];
  let nextPath: string | null = firstPath;

  while (nextPath) {
    const result = await pulpFetch<PulpPaginatedJson<ContentRow>>(nextPath, auth);
    if (!result.ok) {
      return { ok: false, status: result.status, detail: result.detail };
    }
    allResults.push(...result.data.results);
    nextPath = extractNextApiPath(result.data.next);
  }

  return { ok: true, rows: allResults };
}

export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const pulpHref = url.searchParams.get("pulp_href")?.trim();
  if (!pulpHref) {
    return Response.json({ detail: "Query pulp_href is required." }, { status: 400 });
  }

  let decodedHref: string;
  try {
    decodedHref = decodeURIComponent(pulpHref);
  } catch {
    decodedHref = pulpHref;
  }

  const apiRelative = normalizePulpHrefToApiPath(decodedHref);
  const basePath = apiRelative.endsWith("/") ? apiRelative : `${apiRelative}/`;

  async function unauthorizeAndRespond(status: number, detail: string) {
    if (status === 401 || status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }
    return Response.json({ detail }, { status });
  }

  if (isRpmRepositoryPath(basePath)) {
    const repoResult = await pulpFetch<Record<string, unknown>>(basePath, authResult.auth);
    if (!repoResult.ok) {
      return unauthorizeAndRespond(repoResult.status, repoResult.detail);
    }

    const latestVersionHref = repoResult.data.latest_version_href;
    if (typeof latestVersionHref !== "string" || latestVersionHref.length === 0) {
      return Response.json({ count: 0, totalSizeBytes: 0, results: [] });
    }

    const packagesPath = `/content/rpm/packages/?repository_version=${encodeURIComponent(
      latestVersionHref
    )}&limit=100&fields=${RPM_PACKAGE_FIELDS}`;

    const pages = await loadAllPages(packagesPath, authResult.auth);
    if (!pages.ok) {
      return unauthorizeAndRespond(pages.status, pages.detail);
    }

    let totalSizeBytes = 0;
    for (const row of pages.rows) {
      totalSizeBytes += numOrNull(row.size_package) ?? 0;
    }

    return Response.json({
      count: pages.rows.length,
      totalSizeBytes,
      results: pages.rows,
    });
  }

  const pages = await loadAllPages(`${basePath}content/`, authResult.auth);
  if (!pages.ok) {
    return unauthorizeAndRespond(pages.status, pages.detail);
  }

  return Response.json({
    count: pages.rows.length,
    totalSizeBytes: null,
    results: pages.rows,
  });
}
