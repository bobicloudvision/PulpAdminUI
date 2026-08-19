import { readApiDetail } from "./http";
import { PulpOrphanCleanupResult } from "./types";

export const pulpOrphanService = {
  async cleanup(orphanProtectionTimeMinutes?: number): Promise<PulpOrphanCleanupResult> {
    const response = await fetch("/api/pulp/orphans/cleanup", {
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
