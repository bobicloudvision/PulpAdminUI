import { pulpFetch } from "@/lib/pulp";
import { isNumericId, pulpFailureResponse, requirePulpAuth } from "../../../_helpers";
import {
  CreatePulpUserRolePayload,
  PulpPaginatedResponse,
  PulpUserRoleAssignment,
} from "@/services/pulp/types";

/** Lists role assignments of a user. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  if (!isNumericId(id)) {
    return Response.json({ detail: "Valid user id is required." }, { status: 400 });
  }

  const result = await pulpFetch<PulpPaginatedResponse<PulpUserRoleAssignment>>(
    `/users/${id}/roles/?limit=500&ordering=role`,
    authResult.auth
  );
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json(result.data);
}

/** Assigns a role to a user. Body: { role: string, content_object?: string | null }. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  if (!isNumericId(id)) {
    return Response.json({ detail: "Valid user id is required." }, { status: 400 });
  }

  let payload: Partial<CreatePulpUserRolePayload> | null = null;
  try {
    payload = (await request.json()) as Partial<CreatePulpUserRolePayload>;
  } catch {
    return Response.json({ detail: "Invalid request body." }, { status: 400 });
  }

  const role = typeof payload?.role === "string" ? payload.role.trim() : "";
  if (!role) {
    return Response.json({ detail: "Role is required." }, { status: 400 });
  }

  const contentObject =
    typeof payload?.content_object === "string" ? payload.content_object.trim() : "";

  const result = await pulpFetch<PulpUserRoleAssignment>(`/users/${id}/roles/`, authResult.auth, {
    method: "POST",
    body: JSON.stringify({ role, content_object: contentObject || null }),
  });
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json(result.data, { status: 201 });
}
