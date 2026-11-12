import { readApiDetail } from "./http";
import {
  PulpContentItem,
  PulpPaginatedResponse,
  PulpRpmPackage,
  PulpRpmPackageSearchResponse,
} from "./types";

const CONTENT_PATH = "/api/pulp/content";

export const pulpContentService = {
  async list(limit: number, offset: number): Promise<PulpPaginatedResponse<PulpContentItem>> {
    const response = await fetch(`${CONTENT_PATH}?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpPaginatedResponse<PulpContentItem>;
  },

  async searchRpmPackages(
    search: string,
    limit: number,
    offset: number
  ): Promise<PulpRpmPackageSearchResponse> {
    const qs = new URLSearchParams({ search, limit: String(limit), offset: String(offset) });
    const response = await fetch(`/api/pulp/content/rpm/packages?${qs}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpRpmPackageSearchResponse;
  },

  async getRpmPackage(id: string): Promise<PulpRpmPackage> {
    const response = await fetch(`/api/pulp/content/rpm/packages/${id}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpRpmPackage;
  },
};
