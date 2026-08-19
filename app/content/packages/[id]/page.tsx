"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FormField } from "@/components/ui/form-field";
import { formatBytes } from "@/lib/format-bytes";
import { pulpContentService } from "@/services/pulp/content-service";
import {
  pulpRepositoryManagementService,
  type RepositoryPublishResult,
} from "@/services/pulp/repository-management-service";
import { pulpRpmRepositoryService } from "@/services/pulp/rpm-repository-service";
import { pulpUploadService } from "@/services/pulp/upload-service";
import {
  PulpAddToRepositoryResult,
  PulpRpmPackage,
  PulpRpmRepository,
  PulpUploadAsRpmResult,
} from "@/services/pulp/types";

function valueOf(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const hrefMatch = raw.match(/href="([^"]+)"/i);
  return hrefMatch?.[1] ?? raw;
}

export default function PackageDetailsPage() {
  const params = useParams<{ id: string }>();
  const packageId = useMemo(() => params?.id ?? "", [params]);
  const { sessionUser, isLoading, isCheckingSession, hasSession, error, setError, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);
  const [pkg, setPkg] = useState<PulpRpmPackage | null>(null);
  const [isCreatingRpm, setIsCreatingRpm] = useState(false);
  const [rpmResult, setRpmResult] = useState<PulpUploadAsRpmResult | null>(null);
  const [repositories, setRepositories] = useState<PulpRpmRepository[]>([]);
  const [selectedRepositoryName, setSelectedRepositoryName] = useState("");
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [isAddingToRepository, setIsAddingToRepository] = useState(false);
  const [addRepositoryResult, setAddRepositoryResult] = useState<PulpAddToRepositoryResult | null>(
    null
  );
  const [isPublishingRepository, setIsPublishingRepository] = useState(false);
  const [publishRepositoryResult, setPublishRepositoryResult] = useState<RepositoryPublishResult | null>(
    null
  );

  useEffect(() => {
    let active = true;

    async function loadPackage() {
      if (!hasSession || !packageId) {
        setPkg(null);
        return;
      }

      try {
        const nextPackage = await pulpContentService.getRpmPackage(packageId);
        if (active) {
          setPkg(nextPackage);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load package.");
        }
      }
    }

    void loadPackage();

    return () => {
      active = false;
    };
  }, [hasSession, packageId, setError]);

  useEffect(() => {
    setSelectedRepositoryName("");
    setAddRepositoryResult(null);
    setPublishRepositoryResult(null);
    setRepositories([]);
  }, [packageId]);

  useEffect(() => {
    if (!hasSession || !pkg) {
      return;
    }

    let active = true;

    async function loadRepositories() {
      setIsLoadingRepositories(true);
      try {
        const page = await pulpRpmRepositoryService.list();
        if (!active) return;
        const sorted = [...page.results].sort((a, b) => a.name.localeCompare(b.name));
        setRepositories(sorted);
      } catch (repoError) {
        if (active) {
          setError(repoError instanceof Error ? repoError.message : "Failed to load repositories.");
        }
      } finally {
        if (active) {
          setIsLoadingRepositories(false);
        }
      }
    }

    void loadRepositories();

    return () => {
      active = false;
    };
  }, [hasSession, pkg, setError]);

  const artifactForApi = pkg ? normalizeUrl(pkg.artifact) ?? (typeof pkg.artifact === "string" ? pkg.artifact : null) : null;

  async function handleUploadAsRpm() {
    if (!artifactForApi) {
      setError("No artifact linked to this package.");
      return;
    }
    setError(null);
    setIsCreatingRpm(true);
    setRpmResult(null);
    try {
      const created = await pulpUploadService.uploadAsRpm(artifactForApi);
      setRpmResult(created);
    } catch (createError) {
      setRpmResult(null);
      setError(createError instanceof Error ? createError.message : "Failed to create RPM content.");
    } finally {
      setIsCreatingRpm(false);
    }
  }

  async function handleAddToRepository(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pkg?.pulp_href) {
      setError("Missing package content href.");
      return;
    }
    if (!selectedRepositoryName) {
      setError("Select a repository.");
      return;
    }

    setError(null);
    setIsAddingToRepository(true);
    setAddRepositoryResult(null);
    setPublishRepositoryResult(null);

    try {
      const added = await pulpUploadService.addToRepository(pkg.pulp_href, selectedRepositoryName);
      setAddRepositoryResult(added);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add package to repository.");
    } finally {
      setIsAddingToRepository(false);
    }
  }

  async function handlePublishRepositoryChanges() {
    const repoHref = addRepositoryResult?.repository?.trim();
    if (!repoHref) {
      setError("Add the package to a repository first, then publish.");
      return;
    }
    setError(null);
    setIsPublishingRepository(true);
    setPublishRepositoryResult(null);
    try {
      const result = await pulpRepositoryManagementService.publishRpm(repoHref);
      setPublishRepositoryResult(result);
    } catch (publishError) {
      setError(
        publishError instanceof Error ? publishError.message : "Failed to publish repository."
      );
    } finally {
      setIsPublishingRepository(false);
    }
  }

  const headerDescription = pkg
    ? `RPM package review: ${pkg.name} (${pkg.version}-${pkg.release}, ${pkg.arch}).`
    : "RPM package review — inspect metadata, dependencies, files, and checksums for this content unit.";

  return (
    <AdminShell
      title="RPM package review"
      description={headerDescription}
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={
        isLoading ||
        isCreatingRpm ||
        isLoadingRepositories ||
        isAddingToRepository ||
        isPublishingRepository
      }
      usersCount={users.length}
      groupsCount={groups.length}
      error={error}
      onLogout={logout}
    >
      {isCheckingSession || isRedirectingToLogin ? (
        <Card>Checking existing session...</Card>
      ) : !pkg ? (
        <Card>Loading package details...</Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardTitle className="mb-2">{pkg.name}</CardTitle>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {pkg.version}-{pkg.release}
                </span>
                <span className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">
                  arch: {pkg.arch}
                </span>
                <span className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">
                  checksum: {pkg.checksum_type}
                </span>
              </div>
              <p>{valueOf(pkg.summary)}</p>
              <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {valueOf(pkg.description)}
              </p>
              {normalizeUrl(pkg.url) ? (
                <a
                  href={normalizeUrl(pkg.url) ?? ""}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {normalizeUrl(pkg.url)}
                </a>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUploadAsRpm}
                  disabled={!artifactForApi || isCreatingRpm}
                >
                  {isCreatingRpm ? "Uploading as RPM..." : "Upload as RPM"}
                </Button>
                {!artifactForApi ? (
                  <span className="text-xs text-zinc-500">No artifact on this package.</span>
                ) : null}
              </div>
              {rpmResult ? (
                <div className="space-y-2 rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-700">
                  <p className="break-all">
                    <span className="font-medium">RPM Content:</span> {rpmResult.content ?? "-"}
                  </p>
                  <p className="break-all">
                    <span className="font-medium">Task:</span> {rpmResult.task ?? "-"}
                  </p>
                  {rpmResult.content ? (
                    <Link
                      href={`/content/preview?href=${encodeURIComponent(rpmResult.content)}`}
                      className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      Preview package
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardTitle className="mb-2">Add to repository</CardTitle>
            <CardContent>
              <form className="flex max-w-xl flex-col gap-3" onSubmit={handleAddToRepository}>
                <FormField label="RPM repository">
                  <select
                    className={cn(
                      "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                    )}
                    value={selectedRepositoryName}
                    onChange={(event) => setSelectedRepositoryName(event.target.value)}
                    disabled={isLoadingRepositories || repositories.length === 0}
                  >
                    <option value="">
                      {isLoadingRepositories
                        ? "Loading repositories…"
                        : repositories.length === 0
                          ? "No repositories found"
                          : "Select a repository"}
                    </option>
                    {repositories.map((repo) => (
                      <option key={repo.pulp_href} value={repo.name}>
                        {repo.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div>
                  <Button type="submit" disabled={!selectedRepositoryName || isAddingToRepository}>
                    {isAddingToRepository ? "Adding…" : "Add to repository"}
                  </Button>
                </div>
              </form>
              {addRepositoryResult ? (
                <div className="mt-3 space-y-3 rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-700">
                  <div className="space-y-1">
                    <p className="break-all">
                      <span className="font-medium">Repository:</span>{" "}
                      {addRepositoryResult.repository ?? "-"}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">Content:</span>{" "}
                      {addRepositoryResult.content ?? "-"}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">Task:</span> {addRepositoryResult.task ?? "-"}
                    </p>
                  </div>
                  {addRepositoryResult.repository ? (
                    <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPublishingRepository}
                        onClick={() => void handlePublishRepositoryChanges()}
                      >
                        {isPublishingRepository ? "Publishing…" : "Publish Repo Changes"}
                      </Button>
                    </div>
                  ) : null}
                  {publishRepositoryResult ? (
                    <div className="space-y-1 rounded-md border border-emerald-200/80 bg-emerald-50/80 p-2 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100">
                      <p className="font-medium">Repository publication started</p>
                      {publishRepositoryResult.publication ? (
                        <p className="break-all font-mono text-[11px] opacity-90">
                          {publishRepositoryResult.publication}
                        </p>
                      ) : (
                        <p className="text-[11px] opacity-90">
                          Publication href not returned (check Pulp tasks if needed).
                        </p>
                      )}
                      {publishRepositoryResult.task ? (
                        <p className="break-all font-mono text-[11px] opacity-80">
                          Task: {publishRepositoryResult.task}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardTitle className="mb-1 text-sm">Package Size</CardTitle>
              <CardContent className="text-xl font-semibold">
                {formatBytes(pkg.size_package)}
              </CardContent>
            </Card>
            <Card>
              <CardTitle className="mb-1 text-sm">Installed Size</CardTitle>
              <CardContent className="text-xl font-semibold">
                {formatBytes(pkg.size_installed)}
              </CardContent>
            </Card>
            <Card>
              <CardTitle className="mb-1 text-sm">Archive Size</CardTitle>
              <CardContent className="text-xl font-semibold">
                {formatBytes(pkg.size_archive)}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardTitle className="mb-2">Checksums</CardTitle>
            <CardContent>
              <TableWrapper>
                <Table>
                  <TableBody>
                    {[
                      ["MD5", pkg.md5],
                      ["SHA1", pkg.sha1],
                      ["SHA224", pkg.sha224],
                      ["SHA256", pkg.sha256],
                      ["SHA384", pkg.sha384],
                      ["SHA512", pkg.sha512],
                    ].map(([label, value]) => (
                      <TableRow key={label}>
                        <TableCell className="w-32 font-medium">{label}</TableCell>
                        <TableCell className="font-mono text-xs">{valueOf(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle className="mb-2">Requires ({pkg.requires.length})</CardTitle>
              <CardContent>
                <TableWrapper>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Relation</TableHeaderCell>
                        <TableHeaderCell>Version</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pkg.requires.slice(0, 30).map((dep, idx) => (
                        <TableRow key={`req-${idx}`}>
                          <TableCell>{valueOf(dep[0])}</TableCell>
                          <TableCell>{valueOf(dep[1])}</TableCell>
                          <TableCell>{`${valueOf(dep[3])}-${valueOf(dep[4])}`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              </CardContent>
            </Card>

            <Card>
              <CardTitle className="mb-2">Provides ({pkg.provides.length})</CardTitle>
              <CardContent>
                <TableWrapper>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Relation</TableHeaderCell>
                        <TableHeaderCell>Version</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pkg.provides.slice(0, 30).map((dep, idx) => (
                        <TableRow key={`prov-${idx}`}>
                          <TableCell>{valueOf(dep[0])}</TableCell>
                          <TableCell>{valueOf(dep[1])}</TableCell>
                          <TableCell>{`${valueOf(dep[3])}-${valueOf(dep[4])}`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardTitle className="mb-2">Files ({pkg.files.length})</CardTitle>
            <CardContent>
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Directory</TableHeaderCell>
                      <TableHeaderCell>Filename</TableHeaderCell>
                      <TableHeaderCell>Checksum</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pkg.files.slice(0, 80).map((file, idx) => (
                      <TableRow key={`file-${idx}`}>
                        <TableCell className="font-mono text-xs">{valueOf(file[1])}</TableCell>
                        <TableCell>{valueOf(file[2])}</TableCell>
                        <TableCell className="font-mono text-xs">{valueOf(file[3])}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>

          <Card>
            <CardTitle className="mb-2">Changelog ({pkg.changelogs.length})</CardTitle>
            <CardContent className="space-y-2 text-sm">
              {pkg.changelogs.map((entry, idx) => (
                <div key={`changelog-${idx}`} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="font-medium">{valueOf(entry[0])}</div>
                  <div className="text-xs text-zinc-500">{valueOf(entry[1])}</div>
                  <div className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {valueOf(entry[2])}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div>
            <Link
              href="/content/list"
              className="inline-flex rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Back to Content List
            </Link>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
