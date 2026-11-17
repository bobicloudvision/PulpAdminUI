"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { pulpTaskService } from "@/services/pulp/task-service";
import { idFromHref } from "@/lib/format-time";

const AGE_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

const STATES = [
  { value: "completed", defaultChecked: true },
  { value: "canceled", defaultChecked: true },
  { value: "failed", defaultChecked: false },
  { value: "skipped", defaultChecked: false },
];

const selectClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

type TaskPurgeDialogProps = {
  onClose: () => void;
  /** Called with the id of the async purge task Pulp started. */
  onStarted: (purgeTaskId: string) => void;
};

export function TaskPurgeDialog({ onClose, onStarted }: TaskPurgeDialogProps) {
  const titleId = useId();
  const [days, setDays] = useState(30);
  const [states, setStates] = useState<Set<string>>(
    () => new Set(STATES.filter((s) => s.defaultChecked).map((s) => s.value))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Fixed reference time for the dialog's lifetime, so the shown cutoff matches what is sent.
  const [openedAt] = useState(() => Date.now());
  const cutoff = new Date(openedAt - days * 86_400_000);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (states.size === 0) return;
    if (
      !window.confirm(
        `Delete all ${[...states].join(", ")} task records finished before ${cutoff.toLocaleString()}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await pulpTaskService.purge(cutoff, [...states]);
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    onStarted(idFromHref(result.task));
  }

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
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Purge old tasks
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Deletes finished task records in bulk. Running and waiting tasks are never purged.
        </p>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm">
            Finished more than
            <select className={selectClass} value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {AGE_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label} ago
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Before {cutoff.toLocaleString()}</span>
          </label>
          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1">States to purge</legend>
            <div className="flex flex-wrap gap-4">
              {STATES.map((s) => (
                <label key={s.value} className="inline-flex items-center gap-2 capitalize">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                    checked={states.has(s.value)}
                    onChange={(event) =>
                      setStates((prev) => {
                        const next = new Set(prev);
                        if (event.target.checked) next.add(s.value);
                        else next.delete(s.value);
                        return next;
                      })
                    }
                  />
                  {s.value}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || states.size === 0}>
              {busy ? "Starting…" : "Start purge"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
