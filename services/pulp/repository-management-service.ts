import { readApiDetail } from "./http";
import {
  DebRepositoryCreatePayload,
  DebRepositoryUpdatePayload,
  FileRepositoryCreatePayload,
  FileRepositoryUpdatePayload,
  PulpPaginatedResponse,
  PulpRepository,
  PulpRepositoryDetail,
  RpmRepositoryCreatePayload,
  RpmRepositoryUpdatePayload,
  PulpRpmRepositoryVersion,
  RpmRepositoryVersionsListResult,
} from "./types";

export type RepositoryPublishResult = {
  publication: string | null;
  repository: string;
  task: string | null;
};

export type RepositoryCreateResult = {
  name: string;
  pulp_href: string | null;
  task: string | null;
};

export type RepositoryContentListResult = {
  count: number;
  results: Record<string, unknown>[];
};

export type RepositoryUpdateResult = {
  ok: true;
  name: string;
};

export const pulpRepositoryManagementService = {
  async listRpm(limit = 200, offset = 0): Promise<PulpPaginatedResponse<PulpRepository>> {
    const response = await fetch(`/api/pulp/repositories/rpm?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as PulpPaginatedResponse<PulpRepository>;
  },

  async listDeb(limit = 200, offset = 0): Promise<PulpPaginatedResponse<PulpRepository>> {
    const response = await fetch(`/api/pulp/repositories/deb?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as PulpPaginatedResponse<PulpRepository>;
  },

  async listFile(limit = 200, offset = 0): Promise<PulpPaginatedResponse<PulpRepository>> {
    const response = await fetch(`/api/pulp/repositories/file?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as PulpPaginatedResponse<PulpRepository>;
  },

  async createRpm(payload: RpmRepositoryCreatePayload): Promise<RepositoryCreateResult> {
    const response = await fetch("/api/pulp/repositories/rpm/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryCreateResult;
  },

  async createDeb(payload: DebRepositoryCreatePayload): Promise<RepositoryCreateResult> {
    const response = await fetch("/api/pulp/repositories/deb/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryCreateResult;
  },

  async createFile(payload: FileRepositoryCreatePayload): Promise<RepositoryCreateResult> {
    const response = await fetch("/api/pulp/repositories/file/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryCreateResult;
  },

  async getRepositoryDetail(pulpHref: string): Promise<PulpRepositoryDetail> {
    const response = await fetch(
      `/api/pulp/repositories/detail?pulp_href=${encodeURIComponent(pulpHref)}`
    );
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as PulpRepositoryDetail;
  },

  async updateRpm(pulpHref: string, payload: RpmRepositoryUpdatePayload): Promise<RepositoryUpdateResult> {
    const response = await fetch("/api/pulp/repositories/rpm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref, ...payload }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryUpdateResult;
  },

  async updateDeb(pulpHref: string, payload: DebRepositoryUpdatePayload): Promise<RepositoryUpdateResult> {
    const response = await fetch("/api/pulp/repositories/deb", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref, ...payload }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryUpdateResult;
  },

  async updateFile(
    pulpHref: string,
    payload: FileRepositoryUpdatePayload
  ): Promise<RepositoryUpdateResult> {
    const response = await fetch("/api/pulp/repositories/file", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref, ...payload }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryUpdateResult;
  },

  async deleteRpm(pulpHref: string): Promise<void> {
    const response = await fetch("/api/pulp/repositories/rpm", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
  },

  async deleteDeb(pulpHref: string): Promise<void> {
    const response = await fetch("/api/pulp/repositories/deb", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
  },

  async deleteFile(pulpHref: string): Promise<void> {
    const response = await fetch("/api/pulp/repositories/file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
  },

  async publishRpm(pulpHref: string): Promise<RepositoryPublishResult> {
    const response = await fetch("/api/pulp/repositories/rpm/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryPublishResult;
  },

  async publishDeb(pulpHref: string): Promise<RepositoryPublishResult> {
    const response = await fetch("/api/pulp/repositories/deb/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryPublishResult;
  },

  async publishFile(pulpHref: string): Promise<RepositoryPublishResult> {
    const response = await fetch("/api/pulp/repositories/file/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: pulpHref }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryPublishResult;
  },

  async listRepositoryContent(pulpHref: string): Promise<RepositoryContentListResult> {
    const response = await fetch(
      `/api/pulp/repositories/content?pulp_href=${encodeURIComponent(pulpHref)}`
    );
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RepositoryContentListResult;
  },

  async listRpmRepositoryVersions(pulpHref: string): Promise<RpmRepositoryVersionsListResult> {
    const response = await fetch(
      `/api/pulp/repositories/rpm/versions?pulp_href=${encodeURIComponent(pulpHref)}`
    );
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as RpmRepositoryVersionsListResult;
  },

  async getRpmRepositoryVersion(versionPulpHref: string): Promise<PulpRpmRepositoryVersion> {
    const response = await fetch(
      `/api/pulp/repositories/rpm/version?pulp_href=${encodeURIComponent(versionPulpHref)}`
    );
    if (!response.ok) throw new Error(await readApiDetail(response));
    return (await response.json()) as PulpRpmRepositoryVersion;
  },

  async deleteRpmRepositoryVersion(versionPulpHref: string): Promise<void> {
    const response = await fetch("/api/pulp/repositories/rpm/version", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pulp_href: versionPulpHref }),
    });
    if (!response.ok) throw new Error(await readApiDetail(response));
  },
};
