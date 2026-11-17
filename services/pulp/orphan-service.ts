import { readApiDetail } from "./http";
import { PulpOrphanCleanupResult } from "./types";
import { API_BASE } from "@/lib/base-path";

export const pulpOrphanService = {
  async cleanup(orphanProtectionTimeMinutes?: number): Promise<PulpOrphanCleanupResult> {
    const response = await fetch(`${API_BASE}/orphans/cleanup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orphan_protection_time: orphanProtectionTimeMinutes ?? null,
      }),
    });

    if (!response.ok) {
      throw new Error(await readApiDetail(response));
    }

    return (await response.json()) as PulpOrphanCleanupResult;
  },
};
