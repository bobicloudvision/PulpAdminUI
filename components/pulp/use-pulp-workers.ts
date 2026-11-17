"use client";

import { useCallback, useEffect, useState } from "react";
import { usePulpAuthContext } from "./auth-context";
import { PulpStatus, PulpWorker } from "@/services/pulp/types";
import { pulpTaskService } from "@/services/pulp/task-service";
import { pulpWorkerService, PulpWorkerScope } from "@/services/pulp/worker-service";

type QueueCounts = { running: number; waiting: number };

async function queueCount(state: "running" | "waiting"): Promise<number> {
  const page = await pulpTaskService.list({ limit: 1, offset: 0, filters: { state } });
  return page.count;
}

/** Workers for a scope, plus Pulp /status/ and running/waiting task counts. */
export function usePulpWorkers(enabled: boolean, scope: PulpWorkerScope = "online") {
  const { setError } = usePulpAuthContext();
  const [workers, setWorkers] = useState<PulpWorker[]>([]);
  const [status, setStatus] = useState<PulpStatus | null>(null);
  const [queue, setQueue] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!enabled) {
        setWorkers([]);
        return;
      }

      setLoading(true);
      try {
        const [next, nextStatus, running, waiting] = await Promise.all([
          pulpWorkerService.list(scope),
          pulpWorkerService.status().catch(() => null),
          queueCount("running").catch(() => null),
          queueCount("waiting").catch(() => null),
        ]);
        if (active) {
          setWorkers(next);
          setStatus(nextStatus);
          setQueue(running === null || waiting === null ? null : { running, waiting });
          setLastUpdated(Date.now());
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : "Failed to load workers.");
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
  }, [enabled, scope, setError, tick]);

  return { workers, status, queue, loading, lastUpdated, refresh };
}
