"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { durationBetween, formatDuration, formatIso, idFromHref } from "@/lib/format-time";
import { pulpTaskService } from "@/services/pulp/task-service";
import { PulpTask } from "@/services/pulp/types";
import { ProgressBar, TaskStateBadge, isTaskActive } from "./task-ui";
import { useNow } from "./use-now";

type TaskError = { description?: string; traceback?: string } & Record<string, unknown>;

const ACTIVE_POLL_MS = 3000;
const FINISHED_STATES = ["completed", "failed", "canceled", "skipped"];

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={cn("truncate text-sm text-zinc-900 dark:text-zinc-100", mono && "font-mono text-xs")}>
        {children}
      </dd>
    </div>
  );
}

function HrefList({ items }: { items: string[] }) {
  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-zinc-200 p-2 font-mono text-xs dark:border-zinc-800">
      {items.map((href) => (
        <li key={href} className="break-all">
          {href}
        </li>
      ))}
    </ul>
  );
}

type TaskDetailsDialogProps = {
  taskId: string;
  onClose: () => void;
  /** Open another task (parent/child) in the same dialog. */
  onOpenTask: (taskId: string) => void;
  /** Called after cancel/delete so the list can refresh. */
  onChanged: () => void;
};

export function TaskDetailsDialog({ taskId, onClose, onOpenTask, onChanged }: TaskDetailsDialogProps) {
  const titleId = useId();
  const now = useNow();
  const [task, setTask] = useState<PulpTask | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    pulpTaskService
      .get(taskId)
      .then((next) => {
        if (active) {
          setTask(next);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Failed to load task.");
      });
    return () => {
      active = false;
    };
  }, [taskId, tick]);

  // Live-update while the task is still in progress.
  const active = task !== null && isTaskActive(task.state);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((t) => t + 1), ACTIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const runAction = useCallback(
    async (kind: "cancel" | "delete") => {
      const question =
        kind === "cancel" ? "Cancel this task?" : "Delete this task record? This cannot be undone.";
      if (!window.confirm(question)) return;

      setBusy(true);
      setActionError(null);
      const result = kind === "cancel" ? await pulpTaskService.cancel(taskId) : await pulpTaskService.remove(taskId);
      setBusy(false);
      if (!result.ok) {
        setActionError(result.detail);
        return;
      }
      onChanged();
      if (kind === "delete") {
        onClose();
      } else {
        setTick((t) => t + 1);
      }
    },
    [taskId, onChanged, onClose]
  );

  const error = (task?.error ?? null) as TaskError | null;
  const hasError = error !== null && typeof error === "object" && Object.keys(error).length > 0;
  const duration = task ? durationBetween(task.started_at, task.finished_at, now) : null;
  // Queue time: created -> started (or -> finished for tasks canceled before starting, -> now while waiting).
  const waitTime = task ? durationBetween(task.pulp_created, task.started_at ?? task.finished_at, now) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(92vh,900px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {!task ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {loadError ? (
              <span className="text-red-600 dark:text-red-400">{loadError}</span>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading task…
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id={titleId} className="flex flex-wrap items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Task details <TaskStateBadge state={task.state} />
                </h2>
                <p className="mt-1 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">{task.name}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {isTaskActive(task.state) && task.state !== "canceling" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    onClick={() => runAction("cancel")}
                    disabled={busy}
                  >
                    Cancel task
                  </Button>
                ) : null}
                {FINISHED_STATES.includes(task.state) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    onClick={() => runAction("delete")}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>

            {actionError ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {actionError}
              </p>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Task ID" mono>
                {idFromHref(task.pulp_href)}
              </Field>
              <Field label="Created">{formatIso(task.pulp_created)}</Field>
              <Field label="Started">{formatIso(task.started_at)}</Field>
              <Field label="Finished">{formatIso(task.finished_at)}</Field>
              <Field label={task.finished_at ? "Duration" : "Running for"}>
                {duration === null ? "—" : formatDuration(duration)}
              </Field>
              <Field label={task.state === "waiting" ? "Waiting for" : "Waited in queue"}>
                {waitTime === null ? "—" : formatDuration(waitTime)}
              </Field>
              <Field label="Worker" mono>
                {task.worker ? (
                  <Link
                    href={`/tasks/list?worker=${encodeURIComponent(task.worker)}`}
                    className="underline decoration-dotted hover:text-sky-600"
                    title="Show all tasks of this worker"
                    onClick={onClose}
                  >
                    {idFromHref(task.worker)}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Logging CID" mono>
                {task.logging_cid || "—"}
              </Field>
              <Field label="Parent task" mono>
                {task.parent_task ? (
                  <button
                    type="button"
                    className="underline decoration-dotted hover:text-sky-600"
                    onClick={() => onOpenTask(idFromHref(task.parent_task))}
                  >
                    {idFromHref(task.parent_task)}
                  </button>
                ) : (
                  "—"
                )}
              </Field>
            </dl>

            {task.progress_reports.length > 0 ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Progress</h3>
                <ul className="mt-2 space-y-3">
                  {task.progress_reports.map((report) => (
                    <li key={`${report.code}-${report.message}`} className="text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-zinc-800 dark:text-zinc-200">{report.message}</span>
                        <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {report.total > 0
                            ? `${report.done.toLocaleString()} / ${report.total.toLocaleString()}`
                            : report.done.toLocaleString()}
                          {report.suffix ? ` ${report.suffix}` : ""}
                          <TaskStateBadge state={report.state} />
                        </span>
                      </div>
                      {report.total > 0 ? <ProgressBar done={report.done} total={report.total} className="mt-1" /> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {hasError ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Error</h3>
                {error.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-red-700 dark:text-red-300">{error.description}</p>
                ) : null}
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">
                  {error.traceback ?? JSON.stringify(error, null, 2)}
                </pre>
              </section>
            ) : null}

            {task.child_tasks.length > 0 ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Child tasks ({task.child_tasks.length})
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {task.child_tasks.map((href) => (
                    <button
                      key={href}
                      type="button"
                      className="rounded-md border border-zinc-300 px-2 py-1 font-mono text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      onClick={() => onOpenTask(idFromHref(href))}
                    >
                      {idFromHref(href).slice(0, 8)}…
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {task.created_resources.length > 0 ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Created resources ({task.created_resources.length})
                </h3>
                <div className="mt-2">
                  <HrefList items={task.created_resources} />
                </div>
              </section>
            ) : null}

            {task.reserved_resources_record.length > 0 ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Reserved resources ({task.reserved_resources_record.length})
                </h3>
                <div className="mt-2">
                  <HrefList items={task.reserved_resources_record} />
                </div>
              </section>
            ) : null}
          </>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400">
            {active ? `Live — updating every ${ACTIVE_POLL_MS / 1000}s` : ""}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
