import { pulpFetch } from "@/lib/pulp";
import { isNumericId, pulpFailureResponse, requirePulpAuth } from "../../../../_helpers";

/** Removes the user from a group. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id, groupId } = await params;
  if (!isNumericId(id) || !isNumericId(groupId)) {
    return Response.json({ detail: "Valid user and group ids are required." }, { status: 400 });
  }

  const result = await pulpFetch(`/groups/${groupId}/users/${id}/`, authResult.auth, {
    method: "DELETE",
  });
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json({ ok: true });
}
