import { cookies } from "next/headers";
import { decodePulpAuth, PULP_AUTH_COOKIE, type PulpAuth } from "@/lib/pulp";

export async function requirePulpAuth(): Promise<
  { ok: true; auth: PulpAuth } | { ok: false; response: Response }
> {
  const cookieStore = await cookies();
  const encoded = cookieStore.get(PULP_AUTH_COOKIE)?.value;
  if (!encoded) {
    return {
      ok: false,
      response: Response.json({ detail: "Not authenticated." }, { status: 401 }),
    };
  }

  const auth = decodePulpAuth(encoded);
  if (!auth) {
    cookieStore.delete(PULP_AUTH_COOKIE);
    return {
      ok: false,
      response: Response.json({ detail: "Invalid session." }, { status: 401 }),
    };
  }

  return { ok: true, auth };
}

/** Converts a failed pulpFetch result into a route response, clearing the session on 401/403. */
export async function pulpFailureResponse(result: {
  status: number;
  detail: string;
}): Promise<Response> {
  if (result.status === 401 || result.status === 403) {
    const cookieStore = await cookies();
    cookieStore.delete(PULP_AUTH_COOKIE);
  }

  return Response.json({ detail: result.detail }, { status: result.status });
}

const NUMERIC_ID_RE = /^\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isNumericId(value: unknown): value is string {
  return typeof value === "string" && NUMERIC_ID_RE.test(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
