import { readApiDetail } from "./http";
import { PulpDistribution, ServiceResult, UpdatePulpDistributionPayload } from "./types";

export type CreateRpmDistributionResult = {
  name: string;
  pulp_href: string | null;
  base_url: string | null;
  base_path: string;
  task: string | null;
};

type PulpListResponse<T> = {
  results: T[];
};

const DISTRIBUTIONS_PATH = "/api/pulp/distributions";

function encodeDistributionRef(pulpHref: string): string | null {
  const normalized = pulpHref.trim();
  if (normalized.length === 0) {
    return null;
  }

  return encodeURIComponent(normalized);
}

export const pulpDistributionService = {
  async createRpmDistribution(payload: {
    repository: string;
    name: string;
    base_path: string;
  }): Promise<CreateRpmDistributionResult> {
    const response = await fetch("/api/pulp/distributions/rpm/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }
    return (await response.json()) as CreateRpmDistributionResult;
  },

  /**
   * Ensures an RPM distribution for the repository: updates name/base_path if one is already
   * linked, otherwise creates it (`«name»-dist` / base_path = repo name).
   */
  async createRpmDistributionForRepository(
    repositoryPulpHref: string,
    repositoryName: string
  ): Promise<CreateRpmDistributionResult> {
    return pulpDistributionService.createRpmDistribution({
      repository: repositoryPulpHref,
      name: `${repositoryName}-dist`,
      base_path: repositoryName,
    });
  },

  async list(): Promise<PulpDistribution[]> {
    const response = await fetch(DISTRIBUTIONS_PATH);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    const payload = (await response.json()) as PulpListResponse<PulpDistribution>;
    return payload.results;
  },

  async update(
    pulpHref: string,
    payload: UpdatePulpDistributionPayload
  ): Promise<ServiceResult> {
    const encodedRef = encodeDistributionRef(pulpHref);
    if (!encodedRef) {
      return { ok: false, detail: "Invalid distribution identifier." };
    }

    const response = await fetch(`${DISTRIBUTIONS_PATH}/${encodedRef}`, {
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

  async remove(pulpHref: string): Promise<ServiceResult> {
    const encodedRef = encodeDistributionRef(pulpHref);
    if (!encodedRef) {
      return { ok: false, detail: "Invalid distribution identifier." };
    }

    const response = await fetch(`${DISTRIBUTIONS_PATH}/${encodedRef}`, {
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
