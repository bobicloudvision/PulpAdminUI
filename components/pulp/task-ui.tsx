"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatRelative } from "@/lib/format-time";
import { PulpTaskProgressReport } from "@/services/pulp/types";

const STATE_CLASS: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  running: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  waiting: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  canceling: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
};

export function TaskStateBadge({ state, className }: { state: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        STATE_CLASS[state] ?? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
        className
      )}
    >
      {state === "running" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
      {state}
    </span>
  );
}

export function isTaskActive(state: string): boolean {
  return state === "running" || state === "waiting" || state === "canceling";
}

export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <div className="h-full rounded-full bg-sky-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The most useful progress report to summarize a running task: first one with a known total. */
export function primaryProgress(reports: PulpTaskProgressReport[] | undefined): PulpTaskProgressReport | null {
  if (!reports || reports.length === 0) return null;
  return (
    reports.find((r) => r.state === "running" && r.total > 0) ??
    reports.find((r) => r.total > 0) ??
    reports[0]
  );
}

export function RefreshControls({
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  loading,
  lastUpdated,
  now,
  intervalSeconds,
}: {
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
  lastUpdated: number | null;
  now: number;
  intervalSeconds: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          checked={autoRefresh}
          onChange={(event) => onAutoRefreshChange(event.target.checked)}
        />
        Auto-refresh ({intervalSeconds}s)
      </label>
      <span className="text-xs" aria-live="polite">
        {lastUpdated ? `Updated ${formatRelative(new Date(lastUpdated).toISOString(), now)}` : ""}
      </span>
      <Button type="button" variant="outline" onClick={onRefresh} disabled={loading} className="gap-2">
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
        Refresh
      </Button>
    </div>
  );
}
