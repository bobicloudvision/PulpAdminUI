"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/cn";
import {
  ROLE_OBJECT_TYPES,
  RoleObjectOption,
  RoleObjectTypeKey,
  roleObjectTypesForPermissions,
} from "@/lib/pulp-role-objects";
import { pulpRoleService } from "@/services/pulp/role-service";
import { PulpRole, PulpUserRoleAssignment, ServiceResult } from "@/services/pulp/types";

const selectClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

const ASSIGN_CONCURRENCY = 4;
/** Ask for confirmation before granting this many roles globally in one go. */
const CONFIRM_GLOBAL_THRESHOLD = 5;

type ScopeMode = "global" | "object" | "custom";

type ObjectsState = {
  loading: boolean;
  error: string | null;
  items: RoleObjectOption[];
  truncated: boolean;
};

type AssignSummary = {
  ok: number;
  failed: { role: string; detail: string }[];
};

type RoleAssignFormProps = {
  roles: PulpRole[];
  rolesLoading: boolean;
  assignments: PulpUserRoleAssignment[];
  disabled: boolean;
  /** Assigns one role; called once per selected role. */
  assignOne: (role: string, contentObject: string | null) => Promise<ServiceResult>;
  /** Called after a batch finishes (reload assignments). */
  onDone: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
};

function roleGroup(name: string): string {
  const dot = name.indexOf(".");
  return dot > 0 ? name.slice(0, dot) : "other";
}

function assignmentKey(role: string, contentObject: string | null | undefined): string {
  return `${role}|${contentObject ?? ""}`;
}

function intersect<T>(lists: T[][]): T[] {
  if (lists.length === 0) return [];
  return lists.reduce((acc, list) => acc.filter((item) => list.includes(item)));
}

function GroupCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
    />
  );
}

export function RoleAssignForm({
  roles,
  rolesLoading,
  assignments,
  disabled,
  assignOne,
  onDone,
  onBusyChange,
}: RoleAssignFormProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const [scopeMode, setScopeMode] = useState<ScopeMode>("global");
  const [objectType, setObjectType] = useState<RoleObjectTypeKey | "">("");
  const [objectHref, setObjectHref] = useState("");
  const [customHref, setCustomHref] = useState("");
  const [objects, setObjects] = useState<Partial<Record<RoleObjectTypeKey, ObjectsState>>>({});

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<AssignSummary | null>(null);
  const running = progress !== null;
  const locked = disabled || running;

  const rolesByName = useMemo(() => new Map(roles.map((r) => [r.name, r])), [roles]);

  const targetHref: string | null =
    scopeMode === "object" ? objectHref || null : scopeMode === "custom" ? customHref.trim() || null : null;
  const scopeIncomplete = scopeMode !== "global" && targetHref === null;

  const assignedKeys = useMemo(
    () => new Set(assignments.map((a) => assignmentKey(a.role, a.content_object))),
    [assignments]
  );
  const isAssigned = (name: string) => assignedKeys.has(assignmentKey(name, targetHref));

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, PulpRole[]>();
    for (const role of roles) {
      if (
        q &&
        !role.name.toLowerCase().includes(q) &&
        !(role.description ?? "").toLowerCase().includes(q)
      ) {
        continue;
      }
      const key = roleGroup(role.name);
      groups.set(key, [...(groups.get(key) ?? []), role]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === "core" ? -1 : b === "core" ? 1 : a.localeCompare(b)))
      .map(([group, list]) => ({ group, roles: list.sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [roles, query]);

  const visibleSelectable = filteredGroups.flatMap((g) => g.roles.map((r) => r.name)).filter((n) => !isAssigned(n));
  const toAssign = [...selected].filter((name) => rolesByName.has(name) && !isAssigned(name));

  // Object scope only makes sense for object types that every selected role applies to.
  const commonTypes = useMemo(
    () =>
      intersect(
        [...selected]
          .map((name) => rolesByName.get(name))
          .filter((r): r is PulpRole => r !== undefined)
          .map((r) => roleObjectTypesForPermissions(r.permissions))
      ),
    [selected, rolesByName]
  );

  useEffect(() => {
    if (commonTypes.length === 0) {
      if (scopeMode === "object") setScopeMode("global");
      setObjectType("");
      setObjectHref("");
    } else if (!objectType || !commonTypes.includes(objectType)) {
      setObjectType(commonTypes[0]);
      setObjectHref("");
    }
  }, [commonTypes, objectType, scopeMode]);

  const objectsState = objectType ? objects[objectType] : undefined;

  useEffect(() => {
    if (scopeMode !== "object" || !objectType || objects[objectType]) {
      return;
    }
    const type = objectType;
    setObjects((prev) => ({ ...prev, [type]: { loading: true, error: null, items: [], truncated: false } }));
    pulpRoleService
      .listObjects(type)
      .then((res) =>
        setObjects((prev) => ({
          ...prev,
          [type]: { loading: false, error: null, items: res.results, truncated: res.count > res.results.length },
        }))
      )
      .catch((err: unknown) =>
        setObjects((prev) => ({
          ...prev,
          [type]: {
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load objects.",
            items: [],
            truncated: false,
          },
        }))
      );
  }, [scopeMode, objectType, objects]);

  function toggle(name: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  function setMany(names: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const name of names) {
        if (checked) next.add(name);
        else next.delete(name);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = toAssign;
    if (names.length === 0 || scopeIncomplete) {
      return;
    }
    if (
      targetHref === null &&
      names.length >= CONFIRM_GLOBAL_THRESHOLD &&
      !window.confirm(
        `Assign ${names.length} roles globally? The user will get these permissions on ALL objects.`
      )
    ) {
      return;
    }

    setSummary(null);
    setProgress({ done: 0, total: names.length });
    onBusyChange(true);

    const failed: AssignSummary["failed"] = [];
    const succeeded: string[] = [];
    let done = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < names.length) {
        const name = names[cursor++];
        try {
          const result = await assignOne(name, targetHref);
          if (result.ok) succeeded.push(name);
          else failed.push({ role: name, detail: result.detail });
        } catch (err) {
          failed.push({ role: name, detail: err instanceof Error ? err.message : "Request failed." });
        }
        done += 1;
        setProgress({ done, total: names.length });
      }
    }

    await Promise.all(Array.from({ length: Math.min(ASSIGN_CONCURRENCY, names.length) }, worker));

    try {
      await onDone();
    } catch {
      // The dialog reports reload failures itself.
    }

    setMany(succeeded, false);
    setSummary({ ok: succeeded.length, failed });
    setProgress(null);
    onBusyChange(false);
  }

  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every((name) => selected.has(name));

  return (
    <form className="mt-3 grid gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <Input
            className="w-full pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search roles (e.g. rpm, viewer, owner)…"
            aria-label="Search roles"
            disabled={locked}
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMany(visibleSelectable, !allVisibleSelected)}
            disabled={locked || visibleSelectable.length === 0}
          >
            {allVisibleSelected ? "Unselect all" : query.trim() ? "Select all matching" : "Select all"}
          </Button>
          {selected.size > 0 ? (
            <Button type="button" variant="outline" onClick={() => setSelected(new Set())} disabled={locked}>
              Clear ({selected.size})
            </Button>
          ) : null}
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        {rolesLoading ? (
          <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Loading available roles…</p>
        ) : filteredGroups.length === 0 ? (
          <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No roles match “{query}”.</p>
        ) : (
          filteredGroups.map(({ group, roles: groupRoles }) => {
            const selectable = groupRoles.map((r) => r.name).filter((n) => !isAssigned(n));
            const selectedCount = selectable.filter((n) => selected.has(n)).length;
            return (
              <div key={group}>
                <label className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <GroupCheckbox
                    checked={selectable.length > 0 && selectedCount === selectable.length}
                    indeterminate={selectedCount > 0 && selectedCount < selectable.length}
                    disabled={locked || selectable.length === 0}
                    onChange={(checked) => setMany(selectable, checked)}
                    label={`Select all ${group} roles`}
                  />
                  {group}
                  <span className="font-normal normal-case tracking-normal text-zinc-400">
                    {groupRoles.length} {groupRoles.length === 1 ? "role" : "roles"}
                  </span>
                </label>
                {groupRoles.map((role) => {
                  const assigned = isAssigned(role.name);
                  return (
                    <label
                      key={role.name}
                      className={cn(
                        "flex items-start gap-2 px-3 py-2 text-sm",
                        assigned
                          ? "cursor-default opacity-60"
                          : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900",
                        selected.has(role.name) && !assigned && "bg-zinc-100 dark:bg-zinc-900"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-700"
                        checked={assigned || selected.has(role.name)}
                        disabled={locked || assigned}
                        onChange={(event) => toggle(role.name, event.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-zinc-900 dark:text-zinc-50">{role.name}</span>
                          {assigned ? <Badge variant="success">Assigned</Badge> : null}
                        </span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {role.description ||
                            `${role.permissions.length} ${role.permissions.length === 1 ? "permission" : "permissions"}`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <fieldset className="grid gap-2 text-sm" disabled={locked}>
        <legend className="mb-1 font-medium text-zinc-900 dark:text-zinc-50">Apply to</legend>
        <label className="inline-flex items-center gap-2">
          <input type="radio" checked={scopeMode === "global"} onChange={() => setScopeMode("global")} />
          All objects (global)
        </label>
        <label
          className={cn("inline-flex items-center gap-2", commonTypes.length === 0 && "opacity-50")}
          title={
            commonTypes.length === 0
              ? selected.size === 0
                ? "Select roles first"
                : "The selected roles don't share an object type"
              : undefined
          }
        >
          <input
            type="radio"
            checked={scopeMode === "object"}
            onChange={() => setScopeMode("object")}
            disabled={commonTypes.length === 0}
          />
          A specific object
          {commonTypes.length === 0 && selected.size > 1 ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">(selected roles span different object types)</span>
          ) : null}
        </label>
        {scopeMode === "object" && objectType ? (
          <div className="grid gap-2 pl-6 sm:grid-cols-2">
            {commonTypes.length > 1 ? (
              <select
                className={selectClass}
                value={objectType}
                onChange={(event) => {
                  setObjectType(event.target.value as RoleObjectTypeKey);
                  setObjectHref("");
                }}
                aria-label="Object type"
              >
                {commonTypes.map((type) => (
                  <option key={type} value={type}>
                    {ROLE_OBJECT_TYPES[type].label}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className={cn(selectClass, commonTypes.length <= 1 && "sm:col-span-2")}
              value={objectHref}
              onChange={(event) => setObjectHref(event.target.value)}
              disabled={!objectsState || objectsState.loading || objectsState.items.length === 0}
              aria-label={ROLE_OBJECT_TYPES[objectType].label}
            >
              <option value="">
                {!objectsState || objectsState.loading
                  ? "Loading…"
                  : objectsState.items.length === 0
                    ? `No ${ROLE_OBJECT_TYPES[objectType].label.toLowerCase()}s found`
                    : `Select ${ROLE_OBJECT_TYPES[objectType].label.toLowerCase()}…`}
              </option>
              {objectsState?.items.map((item) => (
                <option key={item.pulp_href} value={item.pulp_href}>
                  {item.label}
                </option>
              ))}
            </select>
            {objectsState?.error ? (
              <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2">{objectsState.error}</p>
            ) : objectsState?.truncated ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                Showing the first {objectsState.items.length}. Use “Custom href” for others.
              </p>
            ) : null}
          </div>
        ) : null}
        <label className="inline-flex items-center gap-2">
          <input type="radio" checked={scopeMode === "custom"} onChange={() => setScopeMode("custom")} />
          Custom object href
        </label>
        {scopeMode === "custom" ? (
          <div className="pl-6">
            <Input
              className="w-full"
              value={customHref}
              onChange={(event) => setCustomHref(event.target.value)}
              placeholder="/pulp/api/v3/repositories/rpm/rpm/<uuid>/"
              aria-label="Object href"
            />
          </div>
        ) : null}
      </fieldset>

      {summary ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            summary.failed.length > 0
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          )}
        >
          <p>
            Assigned {summary.ok} {summary.ok === 1 ? "role" : "roles"}
            {summary.failed.length > 0 ? `, ${summary.failed.length} failed (still selected)` : ""}.
          </p>
          {summary.failed.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {summary.failed.map((f) => (
                <li key={f.role}>
                  <span className="font-medium">{f.role}</span>: {f.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={locked || toAssign.length === 0 || scopeIncomplete}>
          {running
            ? `Assigning ${progress.done}/${progress.total}…`
            : toAssign.length === 0
              ? "Assign roles"
              : `Assign ${toAssign.length} ${toAssign.length === 1 ? "role" : "roles"}`}
        </Button>
        {scopeIncomplete && toAssign.length > 0 ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Choose an object first.</span>
        ) : null}
      </div>
    </form>
  );
}
