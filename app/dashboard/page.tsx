"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  CloudCog,
  Cpu,
  LayoutDashboard,
  Loader2,
  Package,
  Shield,
  Upload,
  Users,
  UsersRound,
} from "lucide-react";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import {
  pulpDashboardService,
  type PulpDashboardSummary,
} from "@/services/pulp/dashboard-service";

type QuickLink = {
  href: string;
  label: string;
  description: string;
  icon: typeof Users;
};

const quickLinks: QuickLink[] = [
  {
    href: "/users/list",
    label: "Users",
    description: "Accounts and permissions",
    icon: Users,
  },
  {
    href: "/groups/list",
    label: "Groups",
    description: "Access groups",
    icon: UsersRound,
  },
  {
    href: "/roles/list",
    label: "Roles",
    description: "RBAC roles and permissions",
    icon: Shield,
  },
  {
    href: "/repositories/list",
    label: "Repositories",
    description: "RPM, Debian, and File",
    icon: Boxes,
  },
  {
    href: "/content/list",
    label: "Content",
    description: "Packages and metadata",
    icon: Package,
  },
  {
    href: "/uploads/create",
    label: "Upload",
    description: "Send artifacts to Pulp",
    icon: Upload,
  },
  {
    href: "/tasks/list",
    label: "Tasks",
    description: "Async task history and status",
    icon: ClipboardList,
  },
  {
    href: "/task-schedules/list",
    label: "Task schedules",
    description: "Periodic dispatch and Celery beat",
    icon: CalendarClock,
  },
  {
    href: "/workers/list",
    label: "Workers",
    description: "Task workers and heartbeats",
    icon: Cpu,
  },
];

type StatConfig = {
  key: keyof Pick<
    PulpDashboardSummary,
    "usersCount" | "groupsCount" | "rpmRepositories" | "debRepositories" | "fileRepositories"
  >;
  label: string;
  icon: typeof Users;
  iconWrap: string;
};

const statCards: StatConfig[] = [
  {
    key: "usersCount",
    label: "Users",
    icon: Users,
    iconWrap: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  {
    key: "groupsCount",
    label: "Groups",
    icon: UsersRound,
    iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  {
    key: "rpmRepositories",
    label: "RPM repositories",
    icon: Package,
    iconWrap: "bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200",
  },
  {
    key: "debRepositories",
    label: "Debian repositories",
    icon: Boxes,
    iconWrap: "bg-rose-100 text-rose-800 dark:bg-rose-950/45 dark:text-rose-200",
  },
  {
    key: "fileRepositories",
    label: "File repositories",
    icon: Boxes,
    iconWrap: "bg-sky-100 text-sky-800 dark:bg-sky-950/45 dark:text-sky-200",
  },
];

export default function DashboardPage() {
  const { sessionUser, isLoading, isCheckingSession, hasSession, error, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users } = usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);

  const [summary, setSummary] = useState<PulpDashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!hasSession) {
      setSummary(null);
      setSummaryError(null);
      return;
    }

    try {
      setSummaryError(null);
      const data = await pulpDashboardService.summary();
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setSummaryError(err instanceof Error ? err.message : "Failed to load dashboard stats.");
    }
  }, [hasSession]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <AdminShell
      title="Dashboard"
      description="Overview of your Pulp server. Summary counts are cached on the server for about a minute."
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={isLoading}
      usersCount={users.length}
      groupsCount={groups.length}
      error={error}
      onLogout={logout}
    >
      {isCheckingSession || isRedirectingToLogin ? (
        <Card className="flex items-center gap-3 py-6">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-400" aria-hidden />
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Checking session</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Verifying your Pulp connection…</p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex gap-3 rounded-lg border border-sky-200/90 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-100">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-200/80 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100"
              aria-hidden
            >
              <CloudCog className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-medium">Server-side cache</p>
              <p className="mt-1 text-sky-900/90 dark:text-sky-200/90">
                Totals below are served from a short-lived server cache (60s revalidation) so
                repeated visits stay fast. Navigate away and back to pick up the latest counts sooner.
              </p>
            </div>
          </div>

          {summaryError ? (
            <Card className="border-amber-300 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                  aria-hidden
                >
                  <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle>Summary</CardTitle>
                  <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">{summaryError}</p>
                </div>
              </div>
            </Card>
          ) : null}

          {summary ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {statCards.map(({ key, label, icon: Icon, iconWrap }) => (
                <Card
                  key={key}
                  className="overflow-hidden border-zinc-200/90 shadow-sm dark:border-zinc-800/90"
                >
                  <CardContent className="flex items-start gap-3 p-4 pt-4">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        iconWrap
                      )}
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {label}
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                        {summary[key]}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !summaryError && hasSession ? (
            <Card className="flex items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 shrink-0 animate-spin text-sky-500 dark:text-sky-400" aria-hidden />
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">Loading summary</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Fetching counts from Pulp…</p>
              </div>
            </Card>
          ) : null}

          <Card className="border-zinc-200/90 shadow-sm dark:border-zinc-800/90">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-4 pb-3 pt-4 dark:border-zinc-800/80">
              <LayoutDashboard className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
              <CardTitle className="mb-0">Shortcuts</CardTitle>
            </div>
            <CardContent className="pb-6 pt-5">
              <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/70 p-4 transition hover:border-zinc-300 hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/90"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition group-hover:bg-zinc-200/90 group-hover:text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-300 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-100"
                          aria-hidden
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.65} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {item.label}
                          </span>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
                        </div>
                        <ChevronRight
                          className="h-5 w-5 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
