"use client";

import { FormEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleAssignForm } from "@/components/pulp/role-assign-form";
import { pulpRoleIdFromHref, pulpRoleService } from "@/services/pulp/role-service";
import { pulpUserService } from "@/services/pulp/user-service";
import {
  PulpGroup,
  PulpRole,
  PulpUser,
  PulpUserRoleAssignment,
  ServiceResult,
} from "@/services/pulp/types";

const selectClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

function numericIdFromHref(href: string): number | null {
  const segment = href.replace(/\/+$/, "").split("/").pop() ?? "";
  return /^\d+$/.test(segment) ? Number(segment) : null;
}

type UserAccessDialogProps = {
  user: PulpUser;
  groups: PulpGroup[];
  onClose: () => void;
  /** Reloads the users list so the user's `groups` reflect membership changes. */
  onGroupsChanged: () => Promise<void>;
};

export function UserAccessDialog({ user, groups, onClose, onGroupsChanged }: UserAccessDialogProps) {
  const titleId = useId();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState("");

  const [assignments, setAssignments] = useState<PulpUserRoleAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [roles, setRoles] = useState<PulpRole[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const locked = busy || bulkBusy;

  const memberGroups = useMemo(
    () =>
      (user.groups ?? []).map((ref) => ({
        name: ref.name,
        id: groups.find((g) => g.name === ref.name)?.id ?? numericIdFromHref(ref.pulp_href),
      })),
    [user.groups, groups]
  );

  const availableGroups = useMemo(() => {
    const memberNames = new Set(memberGroups.map((g) => g.name));
    return groups.filter((g) => !memberNames.has(g.name));
  }, [groups, memberGroups]);

  const reloadAssignments = useCallback(async () => {
    setAssignments(await pulpUserService.listRoles(user.id));
  }, [user.id]);

  useEffect(() => {
    let active = true;

    async function load() {
      setAssignmentsLoading(true);
      try {
        const [nextAssignments, roles] = await Promise.all([
          pulpUserService.listRoles(user.id),
          pulpRoleService.listAll(),
        ]);
        if (active) {
          setAssignments(nextAssignments);
          setRoles(roles);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load roles.");
        }
      } finally {
        if (active) {
          setAssignmentsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [user.id]);

  async function run(mutate: () => Promise<ServiceResult>, reload: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      const result = await mutate();
      // Reload even on failure: bulk operations may have partially applied.
      await reload();
      if (!result.ok) {
        setError(result.detail);
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAddGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const groupId = Number(selectedGroupId);
    if (!groupId) {
      return;
    }
    const ok = await run(() => pulpUserService.addToGroup(user.id, groupId), onGroupsChanged);
    if (ok) {
      setSelectedGroupId("");
    }
  }

  async function handleRemoveGroup(groupId: number | null, groupName: string) {
    if (groupId === null) {
      setError(`Could not resolve id for group "${groupName}".`);
      return;
    }
    if (!window.confirm(`Remove ${user.username} from group "${groupName}"?`)) {
      return;
    }
    await run(() => pulpUserService.removeFromGroup(user.id, groupId), onGroupsChanged);
  }

  async function handleRemoveAllRoles() {
    if (
      !window.confirm(
        `Remove all ${assignments.length} role assignments from ${user.username}? This cannot be undone.`
      )
    ) {
      return;
    }
    await run(async () => {
      const failures: string[] = [];
      for (const assignment of assignments) {
        const assignmentId = pulpRoleIdFromHref(assignment.pulp_href);
        const result = assignmentId
          ? await pulpUserService.removeRole(user.id, assignmentId)
          : { ok: false as const, detail: "unknown id" };
        if (!result.ok) {
          failures.push(`${assignment.role}: ${result.detail}`);
        }
      }
      return failures.length === 0
        ? { ok: true }
        : { ok: false, detail: `Failed to remove ${failures.length}: ${failures.join("; ")}` };
    }, reloadAssignments);
  }

  async function handleRemoveRole(assignment: PulpUserRoleAssignment) {
    const assignmentId = pulpRoleIdFromHref(assignment.pulp_href);
    if (!assignmentId) {
      setError("Could not resolve role assignment id.");
      return;
    }
    if (!window.confirm(`Remove role "${assignment.role}" from ${user.username}?`)) {
      return;
    }
    await run(() => pulpUserService.removeRole(user.id, assignmentId), reloadAssignments);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(90vh,820px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Groups &amp; roles
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage group membership and role assignments for{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">{user.username}</span>.
        </p>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Groups</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {memberGroups.length === 0 ? (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Not a member of any group.</span>
            ) : (
              memberGroups.map((group) => (
                <Badge key={group.name} variant="default" className="gap-1 pr-1">
                  {group.name}
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-zinc-300 disabled:opacity-50 dark:hover:bg-zinc-600"
                    aria-label={`Remove from group ${group.name}`}
                    onClick={() => handleRemoveGroup(group.id, group.name)}
                    disabled={locked}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleAddGroup}>
            <select
              className={selectClass}
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              disabled={locked || availableGroups.length === 0}
              aria-label="Group to add"
            >
              <option value="">
                {availableGroups.length === 0 ? "No other groups available" : "Select a group…"}
              </option>
              {availableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={locked || !selectedGroupId} className="shrink-0">
              Add to group
            </Button>
          </form>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Roles{assignments.length > 0 ? ` (${assignments.length})` : ""}
            </h3>
            {assignments.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                onClick={handleRemoveAllRoles}
                disabled={locked}
              >
                Remove all
              </Button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Roles assigned directly to this user. Roles inherited through groups are managed on the group.
          </p>
          <div className="mt-2 max-h-56 divide-y divide-zinc-200 overflow-y-auto rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {assignmentsLoading ? (
              <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Loading roles…</p>
            ) : assignments.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No roles assigned.</p>
            ) : (
              assignments.map((assignment) => (
                <div
                  key={assignment.pulp_href}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{assignment.role}</div>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {assignment.content_object
                        ? assignment.content_object
                        : assignment.domain
                          ? `Domain: ${assignment.domain}`
                          : "Global (model-level)"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    onClick={() => handleRemoveRole(assignment)}
                    disabled={locked}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>

          <h4 className="mt-5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Assign roles</h4>
          <RoleAssignForm
            roles={roles}
            rolesLoading={assignmentsLoading}
            assignments={assignments}
            disabled={locked}
            assignOne={(role, contentObject) =>
              pulpUserService.assignRole(user.id, { role, content_object: contentObject })
            }
            onDone={reloadAssignments}
            onBusyChange={setBulkBusy}
          />
        </section>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
