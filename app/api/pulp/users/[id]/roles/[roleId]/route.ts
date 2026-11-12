import { pulpFetch } from "@/lib/pulp";
import {
  isNumericId,
  isUuid,
  pulpFailureResponse,
  requirePulpAuth,
} from "../../../../_helpers";

/** Removes a role assignment (UserRole id, not the Role id) from a user. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id, roleId } = await params;
  if (!isNumericId(id) || !isUuid(roleId)) {
    return Response.json(
      { detail: "Valid user id and role assignment id are required." },
      { status: 400 }
    );
  }

  const result = await pulpFetch(`/users/${id}/roles/${roleId}/`, authResult.auth, {
    method: "DELETE",
  });
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  return Response.json({ ok: true });
}
