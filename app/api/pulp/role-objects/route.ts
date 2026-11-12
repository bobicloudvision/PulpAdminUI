import { pulpFetch } from "@/lib/pulp";
import {
  isRoleObjectType,
  ROLE_OBJECT_TYPES,
  RoleObjectListResponse,
  RoleObjectTypeConfig,
} from "@/lib/pulp-role-objects";
import { pulpFailureResponse, requirePulpAuth } from "../_helpers";

type PulpObjectRow = {
  pulp_href: string;
  name?: string;
};

type PulpListResponse = {
  count: number;
  results: PulpObjectRow[];
};

const MAX_OBJECTS = 500;

/** Lists objects a role can be scoped to. Query: ?type=<app_label.model> (see ROLE_OBJECT_TYPES). */
export async function GET(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const type = new URL(request.url).searchParams.get("type");
  if (!isRoleObjectType(type)) {
    return Response.json({ detail: "Unsupported object type." }, { status: 400 });
  }

  const config: RoleObjectTypeConfig = ROLE_OBJECT_TYPES[type];
  const qs = new URLSearchParams({ limit: String(MAX_OBJECTS) });
  if (config.nameField) {
    qs.set("ordering", config.nameField);
  }

  const result = await pulpFetch<PulpListResponse>(`${config.path}?${qs}`, authResult.auth);
  if (!result.ok) {
    return pulpFailureResponse(result);
  }

  const body: RoleObjectListResponse = {
    count: result.data.count ?? result.data.results.length,
    results: result.data.results.map((row) => ({
      pulp_href: row.pulp_href,
      label: (config.nameField && row.name) || row.pulp_href,
    })),
  };

  return Response.json(body);
}
