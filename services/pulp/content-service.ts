import { readApiDetail } from "./http";
import {
  PulpContentItem,
  PulpPaginatedResponse,
  PulpRpmPackage,
  PulpRpmPackageSearchResponse,
} from "./types";
import { API_BASE } from "@/lib/base-path";

const CONTENT_PATH = `${API_BASE}/content`;

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
    const response = await fetch(`${API_BASE}/content/rpm/packages?${qs}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpRpmPackageSearchResponse;
  },

  async getRpmPackage(id: string): Promise<PulpRpmPackage> {
    const response = await fetch(`${API_BASE}/content/rpm/packages/${id}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpRpmPackage;
  },
};
