import { readApiDetail } from "./http";
import { PulpStatus, PulpWorker } from "./types";
import { API_BASE } from "@/lib/base-path";

type PulpListResponse<T> = {
  results: T[];
};

const WORKERS_PATH = `${API_BASE}/workers`;

export type PulpWorkerScope = "online" | "all" | "missing";

export const pulpWorkerService = {
  async list(scope: PulpWorkerScope = "online"): Promise<PulpWorker[]> {
    const response = await fetch(`${WORKERS_PATH}?scope=${scope}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    const payload = (await response.json()) as PulpListResponse<PulpWorker>;
    return payload.results;
  },

  async status(): Promise<PulpStatus> {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }
    return (await response.json()) as PulpStatus;
  },
};
