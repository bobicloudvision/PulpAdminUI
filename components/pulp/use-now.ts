"use client";

import { useEffect, useState } from "react";

/** Current time in ms, re-rendering every `intervalMs` (for live "5s ago" / elapsed labels). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Calls `onTick` every `intervalMs` while `enabled` and the tab is visible. */
export function useAutoRefresh(enabled: boolean, intervalMs: number, onTick: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") onTick();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, onTick]);
}
