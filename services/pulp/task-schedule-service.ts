import { readApiDetail } from "./http";
import { PulpPaginatedResponse, PulpTaskSchedule } from "./types";
import { API_BASE } from "@/lib/base-path";

const TASK_SCHEDULES_PATH = `${API_BASE}/task-schedules`;

export const pulpTaskScheduleService = {
  async list(params: { limit: number; offset: number }): Promise<PulpPaginatedResponse<PulpTaskSchedule>> {
    const qs = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
    });
    const response = await fetch(`${TASK_SCHEDULES_PATH}?${qs}`);
    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpPaginatedResponse<PulpTaskSchedule>;
  },
};
