export function formatIso(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** "3s", "4m 12s", "2h 05m", "3d 4h". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  }
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Milliseconds between two ISO timestamps (or until `now` when `end` is missing). */
export function durationBetween(
  start: string | null | undefined,
  end: string | null | undefined,
  now: number
): number | null {
  if (!start) return null;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : now;
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.max(0, e - s);
}

/** "just now", "12s ago", "5m ago", "3h ago", "2d ago". */
export function formatRelative(iso: string | null | undefined, now: number): string {
  const ms = durationBetween(iso, null, now);
  if (ms === null) return "—";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Last path segment of a Pulp href (task/worker uuid). */
export function idFromHref(href: string | null | undefined): string {
  if (!href) return "";
  return href.replace(/\/+$/, "").split("/").pop() ?? href;
}

/** "pulpcore.app.tasks.base.general_update" -> "base.general_update". */
export function shortTaskName(name: string): string {
  const parts = name.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : name;
}
