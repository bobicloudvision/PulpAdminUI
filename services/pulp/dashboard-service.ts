import { readApiDetail } from "./http";

const DASHBOARD_PATH = "/api/pulp/dashboard-summary";

export type PulpDashboardSummary = {
  ok: true;
  usersCount: number;
  groupsCount: number;
  rpmRepositories: number;
  debRepositories: number;
  fileRepositories: number;
  repositoriesTotal: number;
};

export const pulpDashboardService = {
  async summary(): Promise<PulpDashboardSummary> {
    const response = await fetch(DASHBOARD_PATH);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpDashboardSummary;
  },
};
