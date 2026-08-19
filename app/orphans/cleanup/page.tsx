"use client";

import { FormEvent, useState } from "react";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { pulpOrphanService } from "@/services/pulp/orphan-service";
import { PulpOrphanCleanupResult } from "@/services/pulp/types";

export default function OrphanCleanupPage() {
  const { sessionUser, isLoading, isCheckingSession, hasSession, error, setError, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);

  const [protectionTime, setProtectionTime] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PulpOrphanCleanupResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const confirmed = window.confirm(
      "This permanently deletes content and artifacts that are no longer used by any repository. Continue?"
    );
    if (!confirmed) {
      return;
    }

    const trimmed = protectionTime.trim();
    const parsed = trimmed.length > 0 ? Number(trimmed) : undefined;
    if (trimmed.length > 0 && (!Number.isFinite(parsed) || (parsed as number) < 0)) {
      setError("Protection time must be a non-negative number of minutes.");
      return;
    }

    setError(null);
    setResult(null);
    setIsRunning(true);
    try {
      const cleanupResult = await pulpOrphanService.cleanup(parsed);
      setResult(cleanupResult);
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "Orphan cleanup failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <AdminShell
      title="Orphan Cleanup"
      description="Remove content and artifacts that are no longer used by any repository."
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={isLoading || isRunning}
      usersCount={users.length}
      groupsCount={groups.length}
      error={error}
      onLogout={logout}
    >
      {isCheckingSession || isRedirectingToLogin ? (
        <Card>Checking existing session...</Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardTitle>Run cleanup</CardTitle>
            <CardContent>
              <form className="flex flex-col gap-4 md:max-w-md" onSubmit={handleSubmit}>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Permanently deletes Pulp content and artifacts that aren&apos;t referenced by any
                  repository version. This runs as a Pulp task and can take a while on large
                  installations.
                </p>
                <FormField
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      Protection time (minutes)
                      <InfoTooltip text="Content younger than this won't be deleted, even if orphaned — protects content created by tasks still in flight. Leave blank to use the server's ORPHAN_PROTECTION_TIME setting." />
                    </span>
                  }
                >
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Server default"
                    value={protectionTime}
                    onChange={(event) => setProtectionTime(event.target.value)}
                  />
                </FormField>
                <div>
                  <Button type="submit" disabled={isRunning}>
                    {isRunning ? "Cleaning up..." : "Run orphan cleanup"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {result ? (
            <div className="rounded-lg border border-emerald-300/80 bg-emerald-50/90 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/35">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">
                Cleanup {result.state}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-emerald-800/80 dark:text-emerald-300/70">
                Task: {result.task}
              </p>
              {result.progress_reports.length > 0 ? (
                <ul className="mt-2 space-y-1 text-emerald-800 dark:text-emerald-200/90">
                  {result.progress_reports.map((report, index) => (
                    <li key={`${report.code}-${index}`}>
                      {report.message}: {report.done}
                      {report.total ? ` / ${report.total}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
