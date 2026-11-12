"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { AdminShell } from "@/components/pulp/admin-shell";
import { extractRpmPackageContentId } from "@/lib/extract-rpm-package-content-id";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { usePulpContent } from "@/components/pulp/use-pulp-content";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { usePulpRpmPackageSearch } from "@/components/pulp/use-pulp-rpm-package-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function formatNevra(pkg: { name: string; epoch: string | null; version: string; release: string; arch: string }) {
  const epoch = pkg.epoch && pkg.epoch !== "0" ? `${pkg.epoch}:` : "";
  return `${pkg.name}-${epoch}${pkg.version}-${pkg.release}.${pkg.arch}`;
}

/** Shown under the table when a search takes noticeably long (e.g. first index build on older Pulp). */
function SlowSearchHint() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400" role="status">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      Still searching… The first search can take a few seconds while the package list loads.
    </p>
  );
}

function SearchSkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} data-frozen aria-hidden>
          <TableCell>
            <div className="h-4 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </TableCell>
          <TableCell className="text-right">
            <div className="ml-auto h-8 w-28 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

const viewPackageLinkClass =
  "inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

export default function ContentListPage() {
  const { sessionUser, isLoading, isCheckingSession, hasSession, error, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);
  const {
    contentItems,
    count,
    page,
    totalPages,
    canGoNext,
    canGoPrevious,
    goNext,
    goPrevious,
  } = usePulpContent(hasSession, PAGE_SIZE);

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q")?.trim() ?? "";
  const [searchInput, setSearchInput] = useState(urlQuery);
  const [searchTerm, setSearchTerm] = useState(urlQuery);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Keep ?q= in the URL so the search survives "View package" -> back.
  useEffect(() => {
    if (searchTerm === urlQuery) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    if (searchTerm) {
      next.set("q", searchTerm);
    } else {
      next.delete("q");
    }
    const qs = next.toString();
    router.replace(qs ? `/content/list?${qs}` : "/content/list", { scroll: false });
  }, [searchTerm, urlQuery, searchParams, router]);

  const search = usePulpRpmPackageSearch(hasSession, searchTerm, PAGE_SIZE);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

  const isTyping = searchInput.trim() !== searchTerm && searchInput.trim() !== "";
  const searchBusy = isTyping || search.loading;

  const pager = search.active
    ? search
    : { page, totalPages, canGoNext, canGoPrevious, goNext, goPrevious };

  return (
    <AdminShell
      title="Content List"
      description="View all content records from your connected Pulp server."
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
          <CardTitle>
            {search.active ? (
              <>
                <span className="inline-flex items-center gap-2">
                  Search results{search.loading && !search.stale ? "" : ` (${search.count})`} for “{searchTerm}”
                  {search.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Searching" />
                  ) : null}
                </span>
              </>
            ) : (
              <>
                Content ({count}) - Page {page} / {totalPages}
              </>
            )}
          </CardTitle>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearchSubmit} role="search">
              <div className="relative max-w-xl">
                {searchBusy ? (
                  <Loader2
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400"
                    aria-hidden
                  />
                ) : (
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden
                  />
                )}
                <Input
                  type="search"
                  className="w-full pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") clearSearch();
                  }}
                  placeholder="Search RPM packages by name or SHA256…"
                  aria-label="Search RPM packages"
                  aria-busy={searchBusy}
                />
                {searchInput ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {search.match === "server"
                  ? "Name matching is case-sensitive. "
                  : search.match === "index"
                    ? "Matches name or version (case-insensitive). "
                    : ""}
                A 64-character hex value searches by SHA256.
                {search.indexTruncated
                  ? " Only the first 100,000 packages were searched; results may be incomplete."
                  : ""}
              </p>
            </form>

            {search.error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {search.error}
              </p>
            ) : null}

            {search.active ? (
              <TableWrapper aria-busy={search.loading} aria-live="polite">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Package</TableHeaderCell>
                      <TableHeaderCell>Location</TableHeaderCell>
                      <TableHeaderCell>Created</TableHeaderCell>
                      <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody
                    className={search.stale ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}
                  >
                    {search.loading && !search.stale ? (
                      <SearchSkeletonRows />
                    ) : search.results.length === 0 && !search.error ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-zinc-500 dark:text-zinc-400">
                          No RPM packages match “{searchTerm}”.
                        </TableCell>
                      </TableRow>
                    ) : (
                      search.results.map((pkg) => {
                        const rpmPackageId = extractRpmPackageContentId(pkg.pulp_href);
                        return (
                          <TableRow key={pkg.pulp_href}>
                            <TableCell className="font-medium">{formatNevra(pkg)}</TableCell>
                            <TableCell className="font-mono text-xs">{pkg.location_href}</TableCell>
                            <TableCell>{pkg.pulp_created}</TableCell>
                            <TableCell className="text-right">
                              {rpmPackageId ? (
                                <Link href={`/content/packages/${rpmPackageId}`} className={viewPackageLinkClass}>
                                  View package
                                </Link>
                              ) : (
                                <span className="text-xs text-zinc-500">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>
            ) : null}
            {search.active && search.loading ? <SlowSearchHint key={searchTerm} /> : null}
            {search.active ? null : (
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Pulp Href</TableHeaderCell>
                      <TableHeaderCell>Created</TableHeaderCell>
                      <TableHeaderCell>Artifact Names</TableHeaderCell>
                      <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contentItems.map((item) => {
                      const rpmPackageId = extractRpmPackageContentId(item.pulp_href);
                      return (
                        <TableRow key={item.pulp_href}>
                          <TableCell className="font-mono text-xs">{item.pulp_href}</TableCell>
                          <TableCell>{item.pulp_created}</TableCell>
                          <TableCell className="text-xs">
                            {Object.keys(item.artifacts).join(", ") || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {rpmPackageId ? (
                              <Link href={`/content/packages/${rpmPackageId}`} className={viewPackageLinkClass}>
                                View package
                              </Link>
                            ) : (
                              <span className="text-xs text-zinc-500">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrapper>
            )}

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={pager.goPrevious}
                disabled={!pager.canGoPrevious}
              >
                Previous
              </Button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Page {pager.page} of {pager.totalPages}
              </span>
              <Button type="button" variant="outline" onClick={pager.goNext} disabled={!pager.canGoNext}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
