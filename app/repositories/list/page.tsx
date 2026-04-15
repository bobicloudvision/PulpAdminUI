"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CircleHelp,
  GitBranch,
  MoreVertical,
  Package,
  Pencil,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { pulpDistributionService } from "@/services/pulp/distribution-service";
import {
  pulpRepositoryManagementService,
  type RepositoryCreateResult,
} from "@/services/pulp/repository-management-service";
import {
  PulpDistribution,
  PulpRepository,
  type DebRepositoryCreatePayload,
  type FileRepositoryCreatePayload,
  type RpmRepositoryCreatePayload,
} from "@/services/pulp/types";

const repoCreateTextareaClass =
  "min-h-[4rem] w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

function distributionUrlByRepositoryHref(distributions: PulpDistribution[]): Record<string, string> {
  const sorted = [...distributions].sort((a, b) => a.name.localeCompare(b.name));
  const map: Record<string, string> = {};
  for (const d of sorted) {
    if (d.repository && d.base_url && map[d.repository] === undefined) {
      map[d.repository] = d.base_url;
    }
  }
  return map;
}

/** Distributions this UI can delete via `/api/pulp/distributions/[id]` (RPM only). */
function rpmDistributionsForRepository(
  distributions: PulpDistribution[],
  repoPulpHref: string
): PulpDistribution[] {
  return distributions.filter(
    (d) => d.repository === repoPulpHref && /\/distributions\/rpm\/rpm\/[^/]+\/?$/.test(d.pulp_href)
  );
}

type RepoKind = "rpm" | "deb" | "file";

export default function RepositoriesListPage() {
  const deleteDialogTitleId = useId();
  const createDialogTitleId = useId();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { sessionUser, isLoading, isCheckingSession, hasSession, error, setError, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);

  const [kind, setKind] = useState<RepoKind>("rpm");
  const [items, setItems] = useState<PulpRepository[]>([]);
  const [count, setCount] = useState(0);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [distributions, setDistributions] = useState<PulpDistribution[]>([]);
  const [distributionUrlByRepo, setDistributionUrlByRepo] = useState<Record<string, string>>({});
  const [busyHref, setBusyHref] = useState<string | null>(null);
  const [deleteModalRepo, setDeleteModalRepo] = useState<PulpRepository | null>(null);
  const [deleteAlsoDistributions, setDeleteAlsoDistributions] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    repoName: string;
    publication: string | null;
    task: string | null;
  } | null>(null);
  const [distributeResult, setDistributeResult] = useState<{
    repoName: string;
    name: string;
    pulp_href: string | null;
    base_url: string | null;
    base_path: string;
    task: string | null;
  } | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createKind, setCreateKind] = useState<RepoKind>("rpm");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createRemote, setCreateRemote] = useState("");
  const [createAutopublish, setCreateAutopublish] = useState(false);
  const [createManifest, setCreateManifest] = useState("");
  const [createNamingHintOpen, setCreateNamingHintOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<RepositoryCreateResult | null>(null);

  function resetCreateRepositoryFields() {
    setCreateDescription("");
    setCreateRemote("");
    setCreateAutopublish(false);
    setCreateManifest("");
  }

  const load = useCallback(async () => {
    if (!hasSession) return;
    setIsLoadingRepos(true);
    setError(null);
    try {
      const page =
        kind === "rpm"
          ? await pulpRepositoryManagementService.listRpm()
          : kind === "deb"
            ? await pulpRepositoryManagementService.listDeb()
            : await pulpRepositoryManagementService.listFile();
      setItems(page.results);
      setCount(page.count);
      try {
        const distList = await pulpDistributionService.list();
        setDistributions(distList);
        setDistributionUrlByRepo(distributionUrlByRepositoryHref(distList));
      } catch {
        setDistributions([]);
        setDistributionUrlByRepo({});
      }
    } catch (e) {
      setItems([]);
      setCount(0);
      setDistributions([]);
      setDistributionUrlByRepo({});
      setError(e instanceof Error ? e.message : "Failed to load repositories.");
    } finally {
      setIsLoadingRepos(false);
    }
  }, [hasSession, kind, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setCreateKind(kind);
    setCreateModalOpen(true);
    router.replace("/repositories/list", { scroll: false });
  }, [searchParams, router, kind]);

  function openCreateModal() {
    setCreateKind(kind);
    setCreateName("");
    resetCreateRepositoryFields();
    setCreateNamingHintOpen(false);
    setCreateResult(null);
    setError(null);
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (isCreating) return;
    setCreateModalOpen(false);
  }

  useEffect(() => {
    if (!createModalOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isCreating) {
        setCreateModalOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [createModalOpen, isCreating]);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = createName.trim();
    if (!trimmed) {
      setError("Repository name is required.");
      return;
    }
    setError(null);
    setIsCreating(true);
    setCreateResult(null);
    try {
      if (createKind === "rpm") {
        const payload: RpmRepositoryCreatePayload = {
          pulp_labels: {},
          name: trimmed,
          description: createDescription,
          retain_repo_versions: null,
          remote: createRemote.trim() === "" ? null : createRemote.trim(),
          autopublish: createAutopublish,
          metadata_signing_service: null,
          retain_package_versions: null,
          metadata_checksum_type: null,
          package_checksum_type: null,
          gpgcheck: null,
          repo_gpgcheck: null,
          sqlite_metadata: false,
        };

        const result = await pulpRepositoryManagementService.createRpm(payload);
        setCreateResult(result);
        setCreateName("");
        resetCreateRepositoryFields();
      } else if (createKind === "deb") {
        const debPayload: DebRepositoryCreatePayload = {
          pulp_labels: {},
          name: trimmed,
          description: createDescription,
          retain_repo_versions: null,
          remote: createRemote.trim() === "" ? null : createRemote.trim(),
        };
        const result = await pulpRepositoryManagementService.createDeb(debPayload);
        setCreateResult(result);
        setCreateName("");
        resetCreateRepositoryFields();
      } else {
        const filePayload: FileRepositoryCreatePayload = {
          pulp_labels: {},
          name: trimmed,
          description: createDescription,
          retain_repo_versions: null,
          remote: createRemote.trim() === "" ? null : createRemote.trim(),
          autopublish: createAutopublish,
          manifest: createManifest.trim() === "" ? null : createManifest.trim(),
        };
        const result = await pulpRepositoryManagementService.createFile(filePayload);
        setCreateResult(result);
        setCreateName("");
        resetCreateRepositoryFields();
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handlePublish(repo: PulpRepository) {
    setBusyHref(repo.pulp_href);
    setError(null);
    setPublishResult(null);
    setDistributeResult(null);
    try {
      const result =
        kind === "rpm"
          ? await pulpRepositoryManagementService.publishRpm(repo.pulp_href)
          : kind === "deb"
            ? await pulpRepositoryManagementService.publishDeb(repo.pulp_href)
            : await pulpRepositoryManagementService.publishFile(repo.pulp_href);
      setPublishResult({
        repoName: repo.name,
        publication: result.publication,
        task: result.task,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusyHref(null);
    }
  }

  async function handleDistribute(repo: PulpRepository) {
    setBusyHref(repo.pulp_href);
    setError(null);
    setDistributeResult(null);
    try {
      const result = await pulpDistributionService.createRpmDistributionForRepository(
        repo.pulp_href,
        repo.name
      );
      setDistributeResult({
        repoName: repo.name,
        name: result.name,
        pulp_href: result.pulp_href,
        base_url: result.base_url,
        base_path: result.base_path,
        task: result.task,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create distribution.");
    } finally {
      setBusyHref(null);
    }
  }

  function openDeleteModal(repo: PulpRepository) {
    setDeleteModalRepo(repo);
    const linked = rpmDistributionsForRepository(distributions, repo.pulp_href);
    setDeleteAlsoDistributions(linked.length > 0);
  }

  function closeDeleteModal() {
    if (isDeleting) return;
    setDeleteModalRepo(null);
  }

  useEffect(() => {
    if (!deleteModalRepo) {
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        setDeleteModalRepo(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [deleteModalRepo, isDeleting]);

  async function confirmDeleteRepository() {
    const repo = deleteModalRepo;
    if (!repo) return;

    const linked = rpmDistributionsForRepository(distributions, repo.pulp_href);
    setBusyHref(repo.pulp_href);
    setError(null);
    setIsDeleting(true);
    try {
      if (deleteAlsoDistributions && kind === "rpm" && linked.length > 0) {
        for (const d of linked) {
          const removed = await pulpDistributionService.remove(d.pulp_href);
          if (!removed.ok) {
            throw new Error(removed.detail);
          }
        }
      }

      if (kind === "rpm") {
        await pulpRepositoryManagementService.deleteRpm(repo.pulp_href);
      } else if (kind === "deb") {
        await pulpRepositoryManagementService.deleteDeb(repo.pulp_href);
      } else {
        await pulpRepositoryManagementService.deleteFile(repo.pulp_href);
      }

      setDeleteModalRepo(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusyHref(null);
      setIsDeleting(false);
    }
  }

  const deleteModalLinked =
    deleteModalRepo && kind === "rpm"
      ? rpmDistributionsForRepository(distributions, deleteModalRepo.pulp_href)
      : [];

  return (
    <AdminShell
      title="Repositories"
      description="List RPM, Debian, and File repositories; publish, create RPM distributions, inspect content, or remove a repository."
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={isLoading || isLoadingRepos || isDeleting || isCreating}
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
            Repositories ({count}) — {kind.toUpperCase()}
          </CardTitle>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["rpm", "deb", "file"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setPublishResult(null);
                    setDistributeResult(null);
                    setKind(k);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    kind === k
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-zinc-300 dark:border-zinc-700"
                  )}
                >
                  {k.toUpperCase()}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPublishResult(null);
                  setDistributeResult(null);
                  void load();
                }}
                disabled={isLoadingRepos}
              >
                Refresh
              </Button>
              <Button type="button" variant="outline" onClick={openCreateModal}>
                Create repository
              </Button>
            </div>

            {publishResult ? (
              <div className="rounded-lg border border-emerald-300/80 bg-emerald-50/90 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/35">
                <p className="font-medium text-emerald-900 dark:text-emerald-100">
                  Published “{publishResult.repoName}” ({kind.toUpperCase()})
                </p>
                {publishResult.publication ? (
                  <p className="mt-2 break-all font-mono text-xs text-emerald-800 dark:text-emerald-200/90">
                    <span className="font-sans font-medium text-emerald-900 dark:text-emerald-100">
                      Publication:{" "}
                    </span>
                    {publishResult.publication}
                  </p>
                ) : (
                  <p className="mt-2 text-emerald-800/90 dark:text-emerald-200/80">
                    Publication href was not returned by Pulp (task may still have succeeded).
                  </p>
                )}
                {publishResult.task ? (
                  <p className="mt-1 break-all font-mono text-xs text-emerald-800/80 dark:text-emerald-300/70">
                    Task: {publishResult.task}
                  </p>
                ) : null}
              </div>
            ) : null}

            {distributeResult ? (
              <div className="rounded-lg border border-sky-300/80 bg-sky-50/90 p-4 text-sm dark:border-sky-800 dark:bg-sky-950/35">
                <p className="font-medium text-sky-900 dark:text-sky-100">
                  RPM distribution created for “{distributeResult.repoName}”
                </p>
                <p className="mt-1 text-sky-800 dark:text-sky-200/90">
                  <span className="font-medium">Distribution name:</span> {distributeResult.name}
                </p>
                <p className="mt-1 text-sky-800 dark:text-sky-200/90">
                  <span className="font-medium">base_path:</span>{" "}
                  <span className="font-mono text-xs">{distributeResult.base_path}</span>
                </p>
                {distributeResult.base_url ? (
                  <p className="mt-2">
                    <a
                      href={distributeResult.base_url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-mono text-xs text-sky-800 underline decoration-sky-400 underline-offset-2 hover:text-sky-950 dark:text-sky-200 dark:hover:text-sky-50"
                    >
                      {distributeResult.base_url}
                    </a>
                  </p>
                ) : null}
                {distributeResult.pulp_href ? (
                  <p className="mt-1 break-all font-mono text-xs text-sky-800/90 dark:text-sky-300/80">
                    {distributeResult.pulp_href}
                  </p>
                ) : null}
                {distributeResult.task ? (
                  <p className="mt-1 break-all font-mono text-xs text-sky-800/80 dark:text-sky-300/70">
                    Task: {distributeResult.task}
                  </p>
                ) : null}
              </div>
            ) : null}

            <TableWrapper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Distribution URL</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>  
                </TableHead> 
                <TableBody>
                  {items.map((repo) => {
                    const distributionUrl = distributionUrlByRepo[repo.pulp_href];
                    return (
                    <TableRow key={repo.pulp_href} frozen={busyHref === repo.pulp_href}>
                      <TableCell className="font-medium">{repo.name}</TableCell>
                      <TableCell className="max-w-md">
                        {distributionUrl ? (
                          <a
                            href={distributionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-mono text-xs text-sky-800 underline decoration-sky-400/80 underline-offset-2 hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-100"
                          >
                            {distributionUrl}
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                disabled={busyHref === repo.pulp_href}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                                aria-label={`Actions for ${repo.name}`}
                              >
                                <MoreVertical className="size-4" strokeWidth={2} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[11rem]">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/repositories/edit?kind=${kind}&pulp_href=${encodeURIComponent(repo.pulp_href)}`}
                                >
                                  <Pencil className="size-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {kind === "rpm" ? (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/repositories/versions?pulp_href=${encodeURIComponent(repo.pulp_href)}`}
                                  >
                                    <GitBranch className="size-4" />
                                    Versions
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/repositories/content?pulp_href=${encodeURIComponent(repo.pulp_href)}`}
                                >
                                  <Package className="size-4" />
                                  Content
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={busyHref === repo.pulp_href}
                                onSelect={() => void handlePublish(repo)}
                              >
                                <Upload className="size-4" />
                                Publish
                              </DropdownMenuItem>
                              {kind === "rpm" ? (
                                <DropdownMenuItem
                                  disabled={busyHref === repo.pulp_href}
                                  onSelect={() => void handleDistribute(repo)}
                                >
                                  <Share2 className="size-4" />
                                  Distribute
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={busyHref === repo.pulp_href}
                                onSelect={() => openDeleteModal(repo)}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      )}

      {createModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isCreating) {
              closeCreateModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={createDialogTitleId}
            className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2
              id={createDialogTitleId}
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Create repository
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              New RPM, Debian APT, or File repository in Pulp.
            </p>

            <div className="mt-4">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-amber-900 underline decoration-amber-400/70 underline-offset-2 hover:decoration-amber-600 disabled:opacity-50 dark:text-amber-200 dark:decoration-amber-600/60 dark:hover:decoration-amber-400"
                aria-expanded={createNamingHintOpen}
                aria-controls={`${createDialogTitleId}-naming-hint`}
                disabled={isCreating}
                onClick={() => setCreateNamingHintOpen((open) => !open)}
              >
                <CircleHelp className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                How to name the repository
              </button>
              <div
                id={`${createDialogTitleId}-naming-hint`}
                role="region"
                aria-label="Repository naming guidance"
                hidden={!createNamingHintOpen}
                className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/60 p-3 text-sm text-zinc-700 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-zinc-300"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">How to name the repository</p>
                <p className="mt-2">
                  Use a path-style name: product or stream, distro family, major version, then architecture
                  (matches how you organize RHEL-style trees).
                </p>
                <p className="mb-1.5 mt-3 font-medium text-zinc-900 dark:text-zinc-100">Examples</p>
                <ul className="space-y-1 rounded-md border border-amber-200/60 bg-white/80 px-3 py-2 font-mono text-xs text-zinc-800 dark:border-amber-900/50 dark:bg-zinc-950/40 dark:text-zinc-200 sm:text-sm">
                  <li>yourpulp-devel/rhel/10/noarch</li>
                  <li>yourpulp-devel/rhel/10/x86_64</li>
                </ul>
              </div>
            </div>

            <form className="mt-4 flex flex-col gap-4" onSubmit={(e) => void handleCreateSubmit(e)}>
              <div className="flex flex-wrap gap-2">
                {(["rpm", "deb", "file"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCreateKind(k)}
                    disabled={isCreating}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm disabled:opacity-50",
                      createKind === k
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-zinc-300 dark:border-zinc-700"
                    )}
                  >
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
              <FormField label="Name">
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  disabled={isCreating}
                />
              </FormField>
              <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <FormField label="Description">
                  <textarea
                    className={repoCreateTextareaClass}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    disabled={isCreating}
                    rows={2}
                    placeholder="Optional"
                  />
                </FormField>
                <FormField label="Remote">
                  <Input
                    value={createRemote}
                    onChange={(e) => setCreateRemote(e.target.value)}
                    disabled={isCreating}
                    placeholder={
                      createKind === "deb"
                        ? "Optional — Pulp APT remote href for sync"
                        : createKind === "file"
                          ? "Optional — Pulp File remote href for sync"
                        : "Optional — Pulp RPM remote href for sync"
                    }
                    className="font-mono text-xs"
                  />
                </FormField>
                {createKind === "rpm" || createKind === "file" ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600"
                      checked={createAutopublish}
                      disabled={isCreating}
                      onChange={(e) => setCreateAutopublish(e.target.checked)}
                    />
                    Autopublish new repository versions after sync
                  </label>
                ) : null}
                {createKind === "file" ? (
                  <FormField label="Manifest filename">
                    <Input
                      value={createManifest}
                      onChange={(e) => setCreateManifest(e.target.value)}
                      disabled={isCreating}
                      placeholder="Optional — defaults to PULP_MANIFEST"
                    />
                  </FormField>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating…" : "Create"}
                </Button>
                <Button type="button" variant="outline" disabled={isCreating} onClick={closeCreateModal}>
                  Cancel
                </Button>
              </div>
            </form>

            {createResult ? (
              <div className="mt-4 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">Created</p>
                <p className="mt-2">
                  <span className="font-medium">Name:</span> {createResult.name}
                </p>
                <p className="mt-1 break-all">
                  <span className="font-medium">Href:</span> {createResult.pulp_href ?? "—"}
                </p>
                <p className="mt-1 break-all">
                  <span className="font-medium">Task:</span> {createResult.task ?? "—"}
                </p>
                {createResult.pulp_href ? (
                  <Link
                    href={`/repositories/content?pulp_href=${encodeURIComponent(createResult.pulp_href)}`}
                    className="mt-3 inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    View content
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {deleteModalRepo ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
              closeDeleteModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteDialogTitleId}
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2
              id={deleteDialogTitleId}
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Delete repository?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{deleteModalRepo.name}</span>
              <span className="mt-1 block break-all font-mono text-xs text-zinc-500 dark:text-zinc-500">
                {deleteModalRepo.pulp_href}
              </span>
            </p>
            {kind === "rpm" ? (
              deleteModalLinked.length > 0 ? (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    checked={deleteAlsoDistributions}
                    disabled={isDeleting}
                    onChange={(e) => setDeleteAlsoDistributions(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Also delete linked RPM distribution
                      {deleteModalLinked.length > 1 ? "s" : ""}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      {deleteModalLinked.map((d) => d.name).join(", ")}
                    </span>
                  </span>
                </label>
              ) : (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  No RPM distribution in the list is linked to this repository.
                </p>
              )
            ) : (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                {kind === "deb"
                  ? "Debian repositories: only the repository will be removed (this app does not delete APT distributions from here)."
                  : "File repositories: only the repository will be removed from this flow."}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={isDeleting} onClick={closeDeleteModal}>
                Cancel
              </Button>
              <Button
                type="button"
                className="border-red-300 bg-red-600 text-white hover:bg-red-700 dark:border-red-800 dark:bg-red-700 dark:hover:bg-red-600"
                disabled={isDeleting}
                onClick={() => void confirmDeleteRepository()}
              >
                {isDeleting ? "Deleting…" : "Delete repository"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
