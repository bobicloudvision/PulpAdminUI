import { readApiDetail } from "./http";
import {
  ChangePulpUserPasswordPayload,
  CreatePulpUserPayload,
  CreatePulpUserRolePayload,
  PulpUser,
  PulpUserRoleAssignment,
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

  async addToGroup(userId: number, groupId: number): Promise<ServiceResult> {
    const response = await fetch(`${USERS_PATH}/${userId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId }),
    });
    if (!response.ok) {
      return { ok: false, detail: await readApiDetail(response) };
    }
    return { ok: true };
  },

  async removeFromGroup(userId: number, groupId: number): Promise<ServiceResult> {
    const response = await fetch(`${USERS_PATH}/${userId}/groups/${groupId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      return { ok: false, detail: await readApiDetail(response) };
    }
    return { ok: true };
  },

  async listRoles(userId: number): Promise<PulpUserRoleAssignment[]> {
    const response = await fetch(`${USERS_PATH}/${userId}/roles`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }
    const payload = (await response.json()) as PulpListResponse<PulpUserRoleAssignment>;
    return payload.results;
  },

  async assignRole(userId: number, payload: CreatePulpUserRolePayload): Promise<ServiceResult> {
    const response = await fetch(`${USERS_PATH}/${userId}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, detail: await readApiDetail(response) };
    }
    return { ok: true };
  },

  /** `assignmentId` is the UserRole uuid (last segment of its pulp_href). */
  async removeRole(userId: number, assignmentId: string): Promise<ServiceResult> {
    const response = await fetch(
      `${USERS_PATH}/${userId}/roles/${encodeURIComponent(assignmentId)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      return { ok: false, detail: await readApiDetail(response) };
    }
    return { ok: true };
  },
};
