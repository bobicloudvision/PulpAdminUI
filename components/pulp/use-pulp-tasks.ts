"use client";

import { useCallback, useEffect, useState } from "react";
import { usePulpAuthContext } from "./auth-context";
import {
  PulpPaginatedResponse,
  PulpTask,
  PulpTaskCounts,
  PulpTaskFilters,
} from "@/services/pulp/types";
import { pulpTaskService } from "@/services/pulp/task-service";

/**
 * Paginated, filtered task list plus per-state counts. `refresh()` reloads in place
 * (previous data stays visible, so auto-refresh doesn't flicker).
 */
export function usePulpTasks(
  enabled: boolean,
  page: number,
  pageSize: number,
  filters: PulpTaskFilters = {}
) {
  const { setError } = usePulpAuthContext();
  const [data, setData] = useState<PulpPaginatedResponse<PulpTask> | null>(null);
  const [counts, setCounts] = useState<PulpTaskCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const { state, name, worker } = filters;

  useEffect(() => {
    let active = true;

    async function load() {
      if (!enabled || page < 1) {
        setData(null);
        setCounts(null);
        return;
      }

      setLoading(true);
      try {
        const activeFilters = { state, name, worker };
        const [next, nextCounts] = await Promise.all([
          pulpTaskService.list({
            limit: pageSize,
            offset: (page - 1) * pageSize,
            filters: activeFilters,
          }),
          pulpTaskService.counts(activeFilters).catch(() => null),
        ]);
        if (active) {
          setData(next);
          setCounts(nextCounts);
          setLastUpdated(Date.now());
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : "Failed to load tasks.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [enabled, page, pageSize, state, name, worker, setError, tick]);

  const totalPages = data == null ? 0 : Math.max(1, Math.ceil(data.count / pageSize));

  return { data, counts, loading, totalPages, lastUpdated, refresh };
}
