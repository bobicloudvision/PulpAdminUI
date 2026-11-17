"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { TaskDetailsDialog } from "@/components/pulp/task-details-dialog";
import { TaskPurgeDialog } from "@/components/pulp/task-purge-dialog";
import {
  ProgressBar,
  RefreshControls,
  TaskStateBadge,
  primaryProgress,
} from "@/components/pulp/task-ui";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { usePulpTasks } from "@/components/pulp/use-pulp-tasks";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { useAutoRefresh, useNow } from "@/components/pulp/use-now";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import {
  durationBetween,
  formatDuration,
  formatIso,
  formatRelative,
  idFromHref,
  shortTaskName,
} from "@/lib/format-time";
import { PULP_TASK_STATES, PulpTaskState } from "@/services/pulp/types";
import { pulpTaskService } from "@/services/pulp/task-service";

const PAGE_SIZE = 50;

const dangerButtonClass =
  "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40";
const REFRESH_SECONDS = 10;
const SEARCH_DEBOUNCE_MS = 400;

/** Always shown as filter chips; other states only when they have tasks. */
const MAIN_STATES: PulpTaskState[] = ["running", "waiting", "failed", "completed", "canceled"];

function isTaskState(value: string | null): value is PulpTaskState {
  return value !== null && (PULP_TASK_STATES as readonly string[]).includes(value);
}

function paginationItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) {
    return [1];
  }
  const delta = 2;
  const range: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }
  const out: (number | "ellipsis")[] = [];
  let prev: number | undefined;
  for (const i of range) {
    if (prev !== undefined && i - prev > 1) {
      out.push("ellipsis");
    }
    out.push(i);
    prev = i;
  }
  return out;
}

function TasksListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  const rawState = searchParams.get("state");
  const stateFilter = isTaskState(rawState) ? rawState : null;
  const nameFilter = searchParams.get("name")?.trim() ?? "";
  const workerFilter = searchParams.get("worker") ?? "";
  const openTaskId = searchParams.get("task");

  const { sessionUser, isLoading, isCheckingSession, hasSession, error, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);
  const { data, counts, loading, totalPages, lastUpdated, refresh } = usePulpTasks(
    hasSession,
    page,
    PAGE_SIZE,
    { state: stateFilter, name: nameFilter || null, worker: workerFilter || null }
  );

  const now = useNow();
  const [autoRefresh, setAutoRefresh] = useState(true);
  useAutoRefresh(autoRefresh && hasSession, REFRESH_SECONDS * 1000, refresh);

  /** Builds a /tasks/list URL from the current params with overrides (null removes a param). */
  const hrefWith = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      return qs ? `/tasks/list?${qs}` : "/tasks/list";
    },
    [searchParams]
  );

  const replaceParams = useCallback(
    (changes: Record<string, string | null>) => router.replace(hrefWith(changes), { scroll: false }),
    [hrefWith, router]
  );

  // Name search: debounce typing into the URL (?name=), resetting to page 1.
  const [nameInput, setNameInput] = useState(nameFilter);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameInput.trim() !== nameFilter) {
        replaceParams({ name: nameInput.trim() || null, page: null });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [nameInput, nameFilter, replaceParams]);

  useEffect(() => {
    if (!data || totalPages < 1 || page <= totalPages) {
      return;
    }
    replaceParams({ page: String(totalPages) });
  }, [data, page, replaceParams, totalPages]);

  const tasks = data?.results ?? [];
  const count = data?.count ?? 0;
  const pages = paginationItems(page, totalPages);
  const totalAll = counts ? Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0) : null;
  const visibleStates = PULP_TASK_STATES.filter(
    (s) => MAIN_STATES.includes(s) || (counts?.[s] ?? 0) > 0 || s === stateFilter
  );

  const openTask = useCallback((id: string | null) => replaceParams({ task: id }), [replaceParams]);

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string; details?: string[] } | null>(
    null
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const cancelableIds = tasks
    .filter((t) => t.state === "running" || t.state === "waiting")
    .map((t) => idFromHref(t.pulp_href));
  // Selections only count while the task is still cancelable and on this page.
  const selectedIds = cancelableIds.filter((id) => selected.has(id));
  const allPageSelected = cancelableIds.length > 0 && selectedIds.length === cancelableIds.length;

  // "Cancel all" targets waiting+running (or just the filtered state) matching name/worker filters.
  const cancelAllState = stateFilter === "running" || stateFilter === "waiting" ? stateFilter : null;
  const cancelAllCount =
    stateFilter !== null && cancelAllState === null
      ? 0
      : cancelAllState
        ? (counts?.[cancelAllState] ?? 0)
        : (counts?.running ?? 0) + (counts?.waiting ?? 0);

  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function reportBulk(result: { requested: number; canceled: number; failed: { id: string; detail: string }[]; truncated: boolean }) {
    const failedCount = result.failed.length;
    setNotice({
      tone: failedCount > 0 ? "warn" : "ok",
      text:
        `Canceled ${result.canceled} of ${result.requested} task${result.requested === 1 ? "" : "s"}` +
        (failedCount > 0 ? `, ${failedCount} failed` : "") +
        (result.truncated ? " (limited to the first 1000 — run again for the rest)" : "") +
        ".",
      details: result.failed.slice(0, 10).map((f) => `${f.id.slice(0, 8)}…: ${f.detail}`),
    });
  }

  async function runBulk(target: Parameters<typeof pulpTaskService.bulkCancel>[0], question: string) {
    if (!window.confirm(question)) return;
    setBulkBusy(true);
    setNotice(null);
    try {
      reportBulk(await pulpTaskService.bulkCancel(target));
      setSelected(new Set());
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Bulk cancel failed." });
    } finally {
      setBulkBusy(false);
      refresh();
    }
  }

  async function cancelTask(id: string, name: string) {
    if (!window.confirm(`Cancel task ${shortTaskName(name)}?`)) return;
    setCancelingId(id);
    setNotice(null);
    const result = await pulpTaskService.cancel(id);
    setCancelingId(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: `Could not cancel ${shortTaskName(name)}: ${result.detail}` });
    }
    refresh();
  }

  return (
    <AdminShell
      title="Task list"
      description="Pulp asynchronous tasks and status."
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
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>
              Tasks
              {data ? (
                <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                  ({count.toLocaleString()} {stateFilter || nameFilter || workerFilter ? "matching" : "total"})
                </span>
              ) : null}
            </CardTitle>
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
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by state">
              <StateChip
                href={hrefWith({ state: null, page: null })}
                label="All"
                count={totalAll}
                active={stateFilter === null}
              />
              {visibleStates.map((s) => (
                <StateChip
                  key={s}
                  href={hrefWith({ state: s, page: null })}
                  label={s}
                  count={counts?.[s] ?? null}
                  active={stateFilter === s}
                  state={s}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-md">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <Input
                  type="search"
                  className="w-full pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setNameInput("");
                  }}
                  placeholder="Filter by task name (e.g. sync, publish, general_update)…"
                  aria-label="Filter by task name"
                />
                {nameInput ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    onClick={() => setNameInput("")}
                    aria-label="Clear name filter"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {workerFilter ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">
                  Worker: <span className="font-mono">{idFromHref(workerFilter).slice(0, 8)}…</span>
                  <Link
                    href={hrefWith({ worker: null, page: null })}
                    scroll={false}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    aria-label="Clear worker filter"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="text-zinc-600 dark:text-zinc-400">
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Bulk actions:"}
              </span>
              {selectedIds.length > 0 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={dangerButtonClass}
                    disabled={bulkBusy}
                    onClick={() =>
                      runBulk(
                        { ids: selectedIds },
                        `Cancel ${selectedIds.length} selected task${selectedIds.length === 1 ? "" : "s"}?`
                      )
                    }
                  >
                    Cancel selected ({selectedIds.length})
                  </Button>
                  <Button type="button" variant="outline" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
                    Clear selection
                  </Button>
                </>
              ) : null}
              {cancelAllCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className={dangerButtonClass}
                  disabled={bulkBusy}
                  onClick={() =>
                    runBulk(
                      {
                        all: true,
                        filters: { state: cancelAllState, name: nameFilter || null, worker: workerFilter || null },
                      },
                      `Cancel ALL ${cancelAllCount.toLocaleString()} ${cancelAllState ?? "waiting and running"} tasks` +
                        (nameFilter || workerFilter ? " matching the current filters" : "") +
                        "?"
                    )
                  }
                >
                  Cancel all {cancelAllState ?? "waiting & running"} ({cancelAllCount.toLocaleString()})
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={bulkBusy} onClick={() => setPurgeOpen(true)}>
                Purge old tasks…
              </Button>
              {bulkBusy ? <span className="text-xs text-zinc-500">Working…</span> : null}
            </div>

            {notice ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  notice.tone === "ok" &&
                    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
                  notice.tone === "warn" &&
                    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
                  notice.tone === "error" &&
                    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                )}
                role="status"
              >
                <div className="flex items-start justify-between gap-3">
                  <p>{notice.text}</p>
                  <button
                    type="button"
                    className="shrink-0 opacity-60 hover:opacity-100"
                    onClick={() => setNotice(null)}
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {notice.details && notice.details.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {notice.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <TableWrapper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className="w-8">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                        checked={allPageSelected}
                        disabled={cancelableIds.length === 0 || bulkBusy}
                        onChange={(event) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const id of cancelableIds) {
                              if (event.target.checked) next.add(id);
                              else next.delete(id);
                            }
                            return next;
                          })
                        }
                        aria-label="Select all cancelable tasks on this page"
                        title="Select all running/waiting tasks on this page"
                      />
                    </TableHeaderCell>
                    <TableHeaderCell>State</TableHeaderCell>
                    <TableHeaderCell>Task</TableHeaderCell>
                    <TableHeaderCell>Created</TableHeaderCell>
                    <TableHeaderCell>Duration</TableHeaderCell>
                    <TableHeaderCell>Progress</TableHeaderCell>
                    <TableHeaderCell>Worker</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody className={cn(loading && !data && "opacity-50")}>
                  {!data ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-zinc-500">
                        Loading tasks…
                      </TableCell>
                    </TableRow>
                  ) : tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-zinc-500">
                        No tasks match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((t) => {
                      const id = idFromHref(t.pulp_href);
                      const duration = durationBetween(t.started_at, t.finished_at, now);
                      const progress = t.state === "running" ? primaryProgress(t.progress_reports) : null;
                      return (
                        <TableRow
                          key={t.pulp_href}
                          className="cursor-pointer"
                          onClick={() => openTask(id)}
                        >
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            {t.state === "running" || t.state === "waiting" ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                                checked={selected.has(id)}
                                disabled={bulkBusy}
                                onChange={(event) => toggleSelected(id, event.target.checked)}
                                aria-label={`Select task ${shortTaskName(t.name)}`}
                              />
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <TaskStateBadge state={t.state} />
                          </TableCell>
                          <TableCell className="max-w-[20rem]">
                            <div className="truncate font-mono text-xs font-medium" title={t.name}>
                              {shortTaskName(t.name)}
                            </div>
                            <div className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                              {id}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm" title={formatIso(t.pulp_created)}>
                            {formatRelative(t.pulp_created, now)}
                          </TableCell>
                          <TableCell
                            className="whitespace-nowrap text-sm tabular-nums"
                            title={`Started: ${formatIso(t.started_at)}\nFinished: ${formatIso(t.finished_at)}`}
                          >
                            {duration === null ? "—" : formatDuration(duration)}
                          </TableCell>
                          <TableCell className="min-w-[8rem] text-xs">
                            {progress ? (
                              <div title={progress.message}>
                                <div className="truncate text-zinc-600 dark:text-zinc-400">
                                  {progress.total > 0
                                    ? `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`
                                    : progress.message}
                                </div>
                                {progress.total > 0 ? (
                                  <ProgressBar done={progress.done} total={progress.total} className="mt-1" />
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[10rem] truncate font-mono text-xs">
                            {t.worker ? (
                              <Link
                                href={hrefWith({ worker: t.worker, page: null })}
                                scroll={false}
                                className="underline decoration-dotted hover:text-sky-600"
                                title="Show tasks of this worker"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {idFromHref(t.worker).slice(0, 8)}…
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {t.state === "running" || t.state === "waiting" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={dangerButtonClass}
                                  disabled={cancelingId === id || bulkBusy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void cancelTask(id, t.name);
                                  }}
                                >
                                  {cancelingId === id ? "Canceling…" : "Cancel"}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTask(id);
                                }}
                              >
                                Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableWrapper>

            {totalPages > 1 ? (
              <nav
                className="flex flex-wrap items-center gap-1 text-sm"
                aria-label="Task list pagination"
              >
                <PaginationLink
                  href={page > 1 ? hrefWith({ page: String(page - 1) }) : null}
                  label="«"
                  disabled={page <= 1 || loading}
                />
                {pages.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-zinc-400 dark:text-zinc-500"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <PaginationLink
                      key={item}
                      href={hrefWith({ page: String(item) })}
                      label={String(item)}
                      active={item === page}
                      disabled={loading}
                    />
                  )
                )}
                <PaginationLink
                  href={page < totalPages ? hrefWith({ page: String(page + 1) }) : null}
                  label="»"
                  disabled={page >= totalPages || loading}
                />
              </nav>
            ) : null}
          </CardContent>
        </Card>
      )}

      {purgeOpen ? (
        <TaskPurgeDialog
          onClose={() => setPurgeOpen(false)}
          onStarted={(purgeTaskId) => {
            setPurgeOpen(false);
            setNotice({ tone: "ok", text: "Purge started. Follow its progress in the task details." });
            refresh();
            openTask(purgeTaskId);
          }}
        />
      ) : null}

      {openTaskId ? (
        <TaskDetailsDialog
          key={openTaskId}
          taskId={openTaskId}
          onClose={() => openTask(null)}
          onOpenTask={(id) => openTask(id)}
          onChanged={refresh}
        />
      ) : null}
    </AdminShell>
  );
}

function StateChip({
  href,
  label,
  count,
  active,
  state,
}: {
  href: string;
  label: string;
  count: number | null;
  active: boolean;
  state?: PulpTaskState;
}) {
  const attention = !active && (count ?? 0) > 0 && (state === "failed" || state === "running");
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-transparent bg-black text-white dark:bg-white dark:text-black"
          : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900",
        attention && state === "failed" && "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
        attention && state === "running" && "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300"
      )}
      aria-current={active ? "true" : undefined}
    >
      {label}
      {count !== null ? (
        <span className={cn("tabular-nums", active ? "opacity-80" : "text-zinc-500 dark:text-zinc-400")}>
          {count.toLocaleString()}
        </span>
      ) : null}
    </Link>
  );
}

function TasksListSuspenseFallback() {
  const { sessionUser, isLoading, hasSession, error, logout } = usePulpAuthContext();
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);

  return (
    <AdminShell
      title="Task list"
      description="Pulp asynchronous tasks and status."
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={isLoading}
      usersCount={users.length}
      groupsCount={groups.length}
      error={error}
      onLogout={logout}
    >
      <Card>Loading task list…</Card>
    </AdminShell>
  );
}

export default function TasksListPage() {
  return (
    <Suspense fallback={<TasksListSuspenseFallback />}>
      <TasksListPageContent />
    </Suspense>
  );
}

const paginationBtnBase =
  "inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-1.5 text-sm transition-opacity";

function PaginationLink({
  href,
  label,
  disabled,
  active,
}: {
  href: string | null;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  if (!href || disabled) {
    return (
      <span
        className={cn(
          paginationBtnBase,
          "cursor-not-allowed border border-zinc-300 opacity-40 dark:border-zinc-700"
        )}
        aria-disabled
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        paginationBtnBase,
        active
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900/80",
        active && "pointer-events-none"
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
