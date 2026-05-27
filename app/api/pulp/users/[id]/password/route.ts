import { cookies } from "next/headers";
import { PULP_AUTH_COOKIE, pulpFetch } from "@/lib/pulp";
import { requirePulpAuth } from "../../../_helpers";

type PulpUser = {
  pulp_href: string;
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
};

type ChangePasswordPayload = {
  password: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ detail: "User id is required." }, { status: 400 });
  }

  let payload: Partial<ChangePasswordPayload> | null = null;
  try {
    payload = (await request.json()) as Partial<ChangePasswordPayload>;
  } catch {
    return Response.json({ detail: "Invalid request body." }, { status: 400 });
  }

  if (typeof payload.password !== "string" || payload.password.length === 0) {
    return Response.json({ detail: "Password is required." }, { status: 400 });
  }

  const result = await pulpFetch<PulpUser>(`/users/${id}/`, authResult.auth, {
    method: "PATCH",
    body: JSON.stringify({ password: payload.password }),
  });

  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }

    return Response.json({ detail: result.detail }, { status: result.status });
  }

  return Response.json({ ok: true });
}
