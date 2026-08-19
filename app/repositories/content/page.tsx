"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { extractRpmPackageContentId } from "@/lib/extract-rpm-package-content-id";
import { formatBytes } from "@/lib/format-bytes";
import { pulpRepositoryManagementService } from "@/services/pulp/repository-management-service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";

function RepositoryContentInner() {
  const searchParams = useSearchParams();
  const pulpHref = searchParams.get("pulp_href")?.trim() ?? "";

  const { sessionUser, isLoading, isCheckingSession, hasSession, error, setError, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);

  const [count, setCount] = useState(0);
  const [totalSizeBytes, setTotalSizeBytes] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  useEffect(() => {
    if (!hasSession || !pulpHref) {
      setRows([]);
      setCount(0);
      setTotalSizeBytes(null);
      return;
    }

    let active = true;

    async function load() {
      setIsLoadingContent(true);
      setError(null);
      try {
        const data = await pulpRepositoryManagementService.listRepositoryContent(pulpHref);
        if (!active) return;
        setCount(data.count);
        setTotalSizeBytes(data.totalSizeBytes);
        setRows(data.results);
      } catch (e) {
        if (active) {
          setRows([]);
          setCount(0);
          setTotalSizeBytes(null);
          setError(e instanceof Error ? e.message : "Failed to load repository content.");
        }
      } finally {
        if (active) setIsLoadingContent(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [hasSession, pulpHref, setError]);

  function rowLabel(row: Record<string, unknown>): string {
    const name = row.name;
    if (typeof name === "string") return name;
    const href = row.pulp_href;
    if (typeof href === "string") return href;
    return "-";
  }

  function rowHref(row: Record<string, unknown>): string | null {
    const href = row.pulp_href;
    return typeof href === "string" ? href : null;
  }

  return (
    <AdminShell
      title="Repository content"
      description="Content units associated with the selected repository (latest repository view)."
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={isLoading || isLoadingContent}
      usersCount={users.length}
      groupsCount={groups.length}
      error={error}
      onLogout={logout}
    >
      {isCheckingSession || isRedirectingToLogin ? (
        <Card>Checking existing session...</Card>
      ) : !pulpHref ? (
        <Card>Missing pulp_href query parameter.</Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardTitle>Repository</CardTitle>
            <CardContent className="break-all font-mono text-xs">{pulpHref}</CardContent>
          </Card>
          <Card>
            <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
              <span>Content ({count})</span>
              {totalSizeBytes !== null ? (
                <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  Total size: {formatBytes(totalSizeBytes)}
                </span>
              ) : null}
            </CardTitle>
            <CardContent>
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Label</TableHeaderCell>
                      <TableHeaderCell>Pulp href</TableHeaderCell>
                      {totalSizeBytes !== null ? (
                        <TableHeaderCell className="text-right">Size</TableHeaderCell>
                      ) : null}
                      <TableHeaderCell className="text-right">Review</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const href = rowHref(row);
                      const pkgId = href ? extractRpmPackageContentId(href) : null;
                      return (
                        <TableRow key={href ?? String(idx)}>
                          <TableCell className="max-w-xs truncate text-sm">{rowLabel(row)}</TableCell>
                          <TableCell className="max-w-md truncate font-mono text-xs">{href ?? "-"}</TableCell>
                          {totalSizeBytes !== null ? (
                            <TableCell className="text-right text-sm">
                              {formatBytes(row.size_package)}
                            </TableCell>
                          ) : null}
                          <TableCell className="text-right">
                            {pkgId ? (
                              <Link
                                href={`/content/packages/${pkgId}`}
                                className="inline-flex rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                              >
                                RPM review
                              </Link>
                            ) : href ? (
                              <Link
                                href={`/content/preview?href=${encodeURIComponent(href)}`}
                                className="inline-flex rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                              >
                                Preview
                              </Link>
                            ) : (
                              <span className="text-xs text-zinc-500">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>
          <Link
            href="/repositories/list"
            className="inline-flex rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Back to repositories
          </Link>
        </div>
      )}
    </AdminShell>
  );
}

export default function RepositoryContentPage() {
  return (
    <Suspense fallback={<Card className="p-6">Loading…</Card>}>
      <RepositoryContentInner />
    </Suspense>
  );
}
