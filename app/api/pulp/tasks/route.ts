import { cookies } from "next/headers";
import { PULP_AUTH_COOKIE, pulpFetch } from "@/lib/pulp";
import { requirePulpAuth } from "../_helpers";
import { applyTaskFilters } from "./_filters";
import { PulpPaginatedResponse, PulpTask } from "@/services/pulp/types";

function parseOffset(value: string | null): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return n;
}

function parseLimit(value: string | null): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 1) {
    return 100;
  }
  return Math.min(500, n);
}

export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const offset = parseOffset(url.searchParams.get("offset"));

  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    ordering: "-pulp_created",
  });
  applyTaskFilters(url.searchParams, qs);

  const result = await pulpFetch<PulpPaginatedResponse<PulpTask>>(
    `/tasks/?${qs.toString()}`,
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
