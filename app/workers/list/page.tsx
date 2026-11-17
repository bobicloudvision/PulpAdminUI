"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { Activity, AlertTriangle, Database, HardDrive, Server, Zap } from "lucide-react";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { RefreshControls, TaskStateBadge } from "@/components/pulp/task-ui";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { usePulpWorkers } from "@/components/pulp/use-pulp-workers";
import { useAutoRefresh, useNow } from "@/components/pulp/use-now";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { formatBytes } from "@/lib/format-bytes";
import {
  durationBetween,
  formatDuration,
  formatIso,
  formatRelative,
  idFromHref,
  shortTaskName,
} from "@/lib/format-time";
import { PulpStatusApp, PulpWorker } from "@/services/pulp/types";
import { PulpWorkerScope } from "@/services/pulp/worker-service";

const REFRESH_SECONDS = 10;
/** Pulp's default WORKER_TTL: a worker without a heartbeat for this long is considered offline. */
const HEARTBEAT_TTL_MS = 30_000;

const SCOPES: { value: PulpWorkerScope; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "all", label: "All" },
  { value: "missing", label: "Missing" },
];

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

type WorkerStatus = "busy" | "idle" | "offline";

function workerStatus(worker: PulpWorker, now: number): WorkerStatus {
  const age = durationBetween(worker.last_heartbeat, null, now);
  if (age === null || age > HEARTBEAT_TTL_MS) return "offline";
  return worker.current_task ? "busy" : "idle";
}

const STATUS_BADGE: Record<WorkerStatus, { label: string; variant: "default" | "success" | "destructive" }> = {
  busy: { label: "Busy", variant: "default" },
  idle: { label: "Idle", variant: "success" },
  offline: { label: "Offline", variant: "destructive" },
};

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
  href,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn";
  href?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
          tone === "bad" && "text-red-700 dark:text-red-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
          tone === "neutral" && "text-zinc-900 dark:text-zinc-50"
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div> : null}
      {children}
    </>
  );
  const className =
    "block rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function AppList({ title, apps, now }: { title: string; apps: PulpStatusApp[]; now: number }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title} ({apps.length})
      </h3>
      {apps.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">None online.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm">
          {apps.map((app) => (
            <li key={app.name} className="flex justify-between gap-3">
              <span className="truncate font-mono text-xs">{stripHtml(app.name)}</span>
              <span className="shrink-0 text-xs text-zinc-500" title={formatIso(app.last_heartbeat)}>
                {formatRelative(app.last_heartbeat, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WorkersListPage() {
  const { sessionUser, isLoading, isCheckingSession, hasSession, error, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const [scope, setScope] = useState<PulpWorkerScope>("online");
  const { workers, status, queue, loading, lastUpdated, refresh } = usePulpWorkers(hasSession, scope);
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);

  const now = useNow();
  const [autoRefresh, setAutoRefresh] = useState(true);
  useAutoRefresh(autoRefresh && hasSession, REFRESH_SECONDS * 1000, refresh);

  const statuses = workers.map((w) => workerStatus(w, now));
  const busyCount = statuses.filter((s) => s === "busy").length;
  const idleCount = statuses.filter((s) => s === "idle").length;
  const onlineWorkers = status?.online_workers?.length ?? null;

  const storage = status?.storage ?? null;
  const storagePct = storage && storage.total > 0 ? Math.round((storage.used / storage.total) * 100) : null;
  const db = status?.database_connection?.connected;
  const redis = status?.redis_connection ? status.redis_connection.connected : null;
  const core = status?.versions?.find((v) => v.component === "core")?.version;
  const plugins = status?.versions?.filter((v) => v.component !== "core") ?? [];

  const queueStalled = queue !== null && queue.waiting > 0 && onlineWorkers === 0;

  return (
    <AdminShell
      title="Worker List"
      description="Pulp task workers, services health and task queue."
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={isLoading}
      usersCount={users.length}
      groupsCount={groups.length}
      error={error}
      onLogout={logout}
    >
      {isCheckingSession || isRedirectingToLogin ? (
        <Card>Checking existing session...</Card>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <RefreshControls
              autoRefresh={autoRefresh}
              onAutoRefreshChange={setAutoRefresh}
              onRefresh={refresh}
              loading={loading}
              lastUpdated={lastUpdated}
              now={now}
              intervalSeconds={REFRESH_SECONDS}
            />
          </div>

          {queueStalled ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {queue.waiting} task{queue.waiting === 1 ? " is" : "s are"} waiting but no workers are online.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={<Server className="h-3.5 w-3.5" aria-hidden />}
              label="Workers online"
              value={onlineWorkers ?? "—"}
              tone={onlineWorkers === 0 ? "bad" : "neutral"}
              hint={scope === "online" ? `${busyCount} busy · ${idleCount} idle` : undefined}
            />
            <StatCard
              icon={<Activity className="h-3.5 w-3.5" aria-hidden />}
              label="Running tasks"
              value={queue?.running ?? "—"}
              href="/tasks/list?state=running"
              hint="Open in task list"
            />
            <StatCard
              icon={<Zap className="h-3.5 w-3.5" aria-hidden />}
              label="Waiting tasks"
              value={queue?.waiting ?? "—"}
              tone={queue && queue.waiting > 0 ? "warn" : "neutral"}
              href="/tasks/list?state=waiting"
              hint="Open in task list"
            />
            <StatCard
              icon={<Database className="h-3.5 w-3.5" aria-hidden />}
              label="Database"
              value={db === undefined ? "—" : db ? "Connected" : "Down"}
              tone={db === undefined ? "neutral" : db ? "good" : "bad"}
            />
            <StatCard
              icon={<Database className="h-3.5 w-3.5" aria-hidden />}
              label="Redis"
              value={!status ? "—" : redis === null ? "Not used" : redis ? "Connected" : "Down"}
              tone={redis === null ? "neutral" : redis ? "good" : "bad"}
            />
            <StatCard
              icon={<HardDrive className="h-3.5 w-3.5" aria-hidden />}
              label="Storage"
              value={storagePct === null ? "—" : `${storagePct}%`}
              tone={storagePct === null ? "neutral" : storagePct >= 90 ? "bad" : storagePct >= 75 ? "warn" : "neutral"}
              hint={storage ? `${formatBytes(storage.free)} free of ${formatBytes(storage.total)}` : "Not reported"}
            >
              {storagePct !== null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      storagePct >= 90 ? "bg-red-500" : storagePct >= 75 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${storagePct}%` }}
                  />
                </div>
              ) : null}
            </StatCard>
          </div>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Workers ({workers.length})</CardTitle>
              <div
                className="inline-flex rounded-md border border-zinc-300 p-0.5 text-sm dark:border-zinc-700"
                role="group"
                aria-label="Worker scope"
              >
                {SCOPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setScope(s.value)}
                    className={cn(
                      "rounded px-3 py-1",
                      scope === s.value
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    )}
                    aria-pressed={scope === s.value}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <CardContent>
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Name</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Last heartbeat</TableHeaderCell>
                      <TableHeaderCell>Started</TableHeaderCell>
                      <TableHeaderCell>Current task</TableHeaderCell>
                      <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-zinc-500">
                          {loading
                            ? "Loading workers…"
                            : scope === "missing"
                              ? "No missing workers."
                              : "No workers returned."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      workers.map((w, i) => {
                        const st = statuses[i];
                        const badge = STATUS_BADGE[st];
                        const heartbeatAge = durationBetween(w.last_heartbeat, null, now) ?? 0;
                        const task = w.current_task_detail;
                        const taskId = idFromHref(w.current_task);
                        const taskElapsed = task ? durationBetween(task.started_at, null, now) : null;
                        return (
                          <TableRow key={w.pulp_href}>
                            <TableCell className="font-medium">{stripHtml(w.name)}</TableCell>
                            <TableCell>
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                            </TableCell>
                            <TableCell
                              className={cn(
                                "whitespace-nowrap text-sm tabular-nums",
                                heartbeatAge > HEARTBEAT_TTL_MS && "text-red-600 dark:text-red-400",
                                heartbeatAge > HEARTBEAT_TTL_MS / 2 &&
                                  heartbeatAge <= HEARTBEAT_TTL_MS &&
                                  "text-amber-600 dark:text-amber-400"
                              )}
                              title={formatIso(w.last_heartbeat)}
                            >
                              {formatRelative(w.last_heartbeat, now)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm" title={formatIso(w.pulp_created)}>
                              {formatRelative(w.pulp_created, now)}
                            </TableCell>
                            <TableCell className="max-w-[20rem]">
                              {w.current_task ? (
                                <Link
                                  href={`/tasks/list?task=${encodeURIComponent(taskId)}`}
                                  className="group block"
                                  title={task?.name ?? w.current_task}
                                >
                                  <span className="flex items-center gap-2">
                                    {task ? <TaskStateBadge state={task.state} /> : null}
                                    <span className="truncate font-mono text-xs group-hover:underline">
                                      {task ? shortTaskName(task.name) : `${taskId.slice(0, 8)}…`}
                                    </span>
                                  </span>
                                  {taskElapsed !== null ? (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      running for {formatDuration(taskElapsed)}
                                    </span>
                                  ) : null}
                                </Link>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/tasks/list?worker=${encodeURIComponent(w.pulp_href)}`}
                                className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                              >
                                Tasks
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>

          {status ? (
            <Card>
              <CardTitle>Services</CardTitle>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {status.online_api_apps ? (
                    <AppList title="API apps" apps={status.online_api_apps} now={now} />
                  ) : null}
                  <AppList title="Content apps" apps={status.online_content_apps ?? []} now={now} />
                </div>
                {core ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400">Versions:</span>
                    <Badge variant="outline">core {core}</Badge>
                    {plugins.map((v) => (
                      <Badge key={v.component} variant="outline">
                        {v.component} {v.version}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
