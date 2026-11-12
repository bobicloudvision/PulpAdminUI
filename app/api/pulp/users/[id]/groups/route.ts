import { pulpFetch } from "@/lib/pulp";
import { isNumericId, pulpFailureResponse, requirePulpAuth } from "../../../_helpers";

type PulpUser = {
  id: number;
  username: string;
};

/** Adds the user to a group. Body: { group_id: number }. */
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

  let payload: { group_id?: unknown } | null = null;
  try {
    payload = (await request.json()) as { group_id?: unknown };
  } catch {
    return Response.json({ detail: "Invalid request body." }, { status: 400 });
  }

  const groupId = String(payload?.group_id ?? "");
  if (!isNumericId(groupId)) {
    return Response.json({ detail: "Valid group id is required." }, { status: 400 });
  }

  // Pulp adds group members by username, so resolve it from the user id.
  const user = await pulpFetch<PulpUser>(`/users/${id}/`, authResult.auth);
  if (!user.ok) {
    return pulpFailureResponse(user);
  }

  const result = await pulpFetch(`/groups/${groupId}/users/`, authResult.auth, {
    method: "POST",
    body: JSON.stringify({ username: user.data.username }),
  });
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json(result.data, { status: 201 });
}
