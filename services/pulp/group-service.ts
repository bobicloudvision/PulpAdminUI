import { readApiDetail } from "./http";
import {
  CreatePulpGroupPayload,
  PulpGroup,
  ServiceResult,
  UpdatePulpGroupPayload,
} from "./types";
import { API_BASE } from "@/lib/base-path";

type PulpListResponse<T> = {
  results: T[];
};

const GROUPS_PATH = `${API_BASE}/groups`;

export const pulpGroupService = {
  async list(): Promise<PulpGroup[]> {
    const response = await fetch(GROUPS_PATH);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    const payload = (await response.json()) as PulpListResponse<PulpGroup>;
    return payload.results;
  },

  async create(payload: CreatePulpGroupPayload): Promise<ServiceResult> {
    const response = await fetch(GROUPS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        detail: await readApiDetail(response),
      };
    }

    return { ok: true };
  },

  async update(id: number, payload: UpdatePulpGroupPayload): Promise<ServiceResult> {
    const response = await fetch(`${GROUPS_PATH}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        detail: await readApiDetail(response),
      };
    }

    return { ok: true };
  },

  async remove(id: number): Promise<ServiceResult> {
    const response = await fetch(`${GROUPS_PATH}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return {
        ok: false,
        detail: await readApiDetail(response),
      };
    }

    return { ok: true };
  },
};
