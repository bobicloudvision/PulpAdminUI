import { readApiDetail } from "./http";
import {
  ChangePulpUserPasswordPayload,
  CreatePulpUserPayload,
  PulpUser,
  ServiceResult,
  UpdatePulpUserPayload,
} from "./types";

type PulpListResponse<T> = {
  results: T[];
};

const USERS_PATH = "/api/pulp/users";

export const pulpUserService = {
  async list(): Promise<PulpUser[]> {
    const response = await fetch(USERS_PATH);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    const payload = (await response.json()) as PulpListResponse<PulpUser>;
    return payload.results;
  },

  async create(payload: CreatePulpUserPayload): Promise<ServiceResult> {
    const response = await fetch(USERS_PATH, {
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

  async update(id: number, payload: UpdatePulpUserPayload): Promise<ServiceResult> {
    const response = await fetch(`${USERS_PATH}/${id}`, {
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
    const response = await fetch(`${USERS_PATH}/${id}`, {
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

  async changePassword(
    id: number,
    payload: ChangePulpUserPasswordPayload
  ): Promise<ServiceResult> {
    const response = await fetch(`${USERS_PATH}/${id}/password`, {
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
};
