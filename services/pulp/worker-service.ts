import { readApiDetail } from "./http";
import { PulpStatus, PulpWorker } from "./types";

type PulpListResponse<T> = {
  results: T[];
};

const WORKERS_PATH = "/api/pulp/workers";

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
    const response = await fetch("/api/pulp/status");
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }
    return (await response.json()) as PulpStatus;
  },
};
