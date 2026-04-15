import { cookies } from "next/headers";
import { getPulpApiUrl, PULP_AUTH_COOKIE, toBasicAuthHeader } from "@/lib/pulp";
import { requirePulpAuth } from "@/app/api/pulp/_helpers";
import type {
  PulpDebRepositoryDetail,
  PulpFileRepositoryDetail,
  PulpRpmRepositoryDetail,
} from "@/services/pulp/types";
import { authHeaders, normalizePulpHrefToApiPath, readDetail } from "../_server";

function isRpmRepositoryDetailPath(path: string): boolean {
  return path.includes("/repositories/rpm/rpm/");
}

function isDebRepositoryDetailPath(path: string): boolean {
  return path.includes("/repositories/deb/apt/");
}

function isFileRepositoryDetailPath(path: string): boolean {
  return path.includes("/repositories/file/file/");
}

function strOrNull(row: Record<string, unknown>, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return null;
}

function numOrNull(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return null;
}

function numOrZero(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return 0;
}

function boolOr(row: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = row[key];
  if (typeof v === "boolean") return v;
  return fallback;
}

function mapRpmDetail(row: Record<string, unknown>, pulpHref: string): PulpRpmRepositoryDetail {
  const name = strOrNull(row, "name") ?? "";
  const href = strOrNull(row, "pulp_href") ?? pulpHref;

  return {
    kind: "rpm",
    pulp_href: href,
    name,
    pulp_created: strOrNull(row, "pulp_created"),
    versions_href: strOrNull(row, "versions_href"),
    latest_version_href: strOrNull(row, "latest_version_href"),
    description: strOrNull(row, "description"),
    retain_repo_versions: numOrNull(row, "retain_repo_versions"),
    remote: strOrNull(row, "remote"),
    autopublish: boolOr(row, "autopublish", false),
    metadata_signing_service: strOrNull(row, "metadata_signing_service"),
    retain_package_versions: numOrZero(row, "retain_package_versions"),
    metadata_checksum_type: strOrNull(row, "metadata_checksum_type"),
    package_checksum_type: strOrNull(row, "package_checksum_type"),
    gpgcheck: numOrZero(row, "gpgcheck"),
    repo_gpgcheck: numOrZero(row, "repo_gpgcheck"),
    sqlite_metadata: boolOr(row, "sqlite_metadata", false),
  };
}

function mapDebDetail(row: Record<string, unknown>, pulpHref: string): PulpDebRepositoryDetail {
  const name = strOrNull(row, "name") ?? "";
  const href = strOrNull(row, "pulp_href") ?? pulpHref;

  return {
    kind: "deb",
    pulp_href: href,
    name,
    description: strOrNull(row, "description"),
    retain_repo_versions: numOrNull(row, "retain_repo_versions"),
    remote: strOrNull(row, "remote"),
    autopublish: boolOr(row, "autopublish", false),
    structured_repo: boolOr(row, "structured_repo", false),
  };
}

function mapFileDetail(row: Record<string, unknown>, pulpHref: string): PulpFileRepositoryDetail {
  const name = strOrNull(row, "name") ?? "";
  const href = strOrNull(row, "pulp_href") ?? pulpHref;

  return {
    kind: "file",
    pulp_href: href,
    name,
    pulp_created: strOrNull(row, "pulp_created"),
    versions_href: strOrNull(row, "versions_href"),
    latest_version_href: strOrNull(row, "latest_version_href"),
    description: strOrNull(row, "description"),
    retain_repo_versions: numOrNull(row, "retain_repo_versions"),
    remote: strOrNull(row, "remote"),
    autopublish: boolOr(row, "autopublish", false),
    manifest: strOrNull(row, "manifest"),
  };
}

export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const pulpHref = url.searchParams.get("pulp_href")?.trim();
  if (!pulpHref) {
    return Response.json({ detail: "pulp_href is required." }, { status: 400 });
  }

  const apiPath = normalizePulpHrefToApiPath(pulpHref);
  if (
    !isRpmRepositoryDetailPath(apiPath) &&
    !isDebRepositoryDetailPath(apiPath) &&
    !isFileRepositoryDetailPath(apiPath)
  ) {
    return Response.json({ detail: "Invalid repository href." }, { status: 400 });
  }

  const authHeader = toBasicAuthHeader(authResult.auth);
  const detailResponse = await fetch(getPulpApiUrl(apiPath), {
    method: "GET",
    headers: authHeaders(authHeader),
    cache: "no-store",
  });

  if (!detailResponse.ok) {
    if (detailResponse.status === 401 || detailResponse.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }
    return Response.json({ detail: await readDetail(detailResponse) }, { status: detailResponse.status });
  }

  const row = (await detailResponse.json()) as Record<string, unknown>;

  if (isRpmRepositoryDetailPath(apiPath)) {
    return Response.json(mapRpmDetail(row, pulpHref));
  }
  if (isDebRepositoryDetailPath(apiPath)) {
    return Response.json(mapDebDetail(row, pulpHref));
  }

  return Response.json(mapFileDetail(row, pulpHref));
}
