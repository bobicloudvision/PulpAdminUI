import { readApiDetail } from "./http";
import { PulpPaginatedResponse, PulpRpmRepository } from "./types";
import { API_BASE } from "@/lib/base-path";

const RPM_REPOS_PATH = `${API_BASE}/repositories/rpm`;

export const pulpRpmRepositoryService = {
  async list(limit = 200, offset = 0): Promise<PulpPaginatedResponse<PulpRpmRepository>> {
    const response = await fetch(`${RPM_REPOS_PATH}?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    const raw = (await response.json()) as PulpPaginatedResponse<
      PulpRpmRepository & { href?: string }
    >;

    return {
      ...raw,
      results: raw.results
        .map((row) => ({
          name: row.name ?? "",
          pulp_href: row.pulp_href ?? row.href ?? "",
        }))
        .filter((row) => row.name.length > 0 && row.pulp_href.length > 0),
    };
  },
};
