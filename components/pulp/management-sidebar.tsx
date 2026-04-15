"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/components/ui/cn";

const PROJECT_NAME = process.env.NEXT_PUBLIC_PULP_PROJECT_NAME;

if (!PROJECT_NAME) {
  throw new Error("Missing PULP_PROJECT_NAME environment variable.");
}

type ManagementSidebarProps = {
  usersCount: number;
  groupsCount: number;
};

type NavIconName =
  | "dashboard"
  | "workers"
  | "tasks"
  | "schedules"
  | "users"
  | "groups"
  | "roles"
  | "content"
  | "upload"
  | "repos";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: NavIconName;
};

const navSections = [
  {
    title: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        hint: "Overview and quick links",
        icon: "dashboard",
      },
    ] satisfies NavItem[],
  },
  {
    title: "Identity",
    items: [{ href: "/users/list", label: "Users", hint: "Browse and manage users", icon: "users" }] satisfies NavItem[],
  },
  {
    title: "Access",
    items: [
      { href: "/groups/list", label: "Groups", hint: "Manage team groups", icon: "groups" },
      { href: "/roles/list", label: "Roles", hint: "RBAC roles and permissions", icon: "roles" },
    ] satisfies NavItem[],
  },
  {
    title: "Repository",
    items: [
      { href: "/repositories/list", label: "Repositories", hint: "RPM, Debian, and File repos", icon: "repos" },
      { href: "/content/list", label: "Content", hint: "Packages and metadata", icon: "content" },
      { href: "/uploads/create", label: "Upload file", hint: "Send file to Pulp", icon: "upload" },
    ] satisfies NavItem[],
  },
  {
    title: "Workers & tasks",
    items: [
      {
        href: "/tasks/list",
        label: "Tasks",
        hint: "Async task history and status",
        icon: "tasks",
      },
      {
        href: "/task-schedules/list",
        label: "Task schedules",
        hint: "Periodic dispatch and Celery beat schedules",
        icon: "schedules",
      },
      {
        href: "/workers/list",
        label: "Workers",
        hint: "Task workers and heartbeats",
        icon: "workers",
      },
    ] satisfies NavItem[],
  }
];

function SidebarIcon({ name }: { name: NavIconName }) {
  const iconClassName = "h-5 w-5 shrink-0";

  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className={iconClassName}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
        </svg>
      );
    case "workers":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClassName}
        >
          <rect x="7.25" y="7.25" width="9.5" height="9.5" rx="1.75" />
          <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="0.85" />
          <path d="M12 4.75v2.25M12 16.75v2.5M4.75 12h2.25M16.75 12h2.5" />
        </svg>
      );
    case "tasks":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClassName}
        >
          <path d="M9 11l2 2 4-4" />
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <path d="M8 16h.01M12 16h4" />
        </svg>
      );
    case "schedules":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClassName}
        >
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M4 9.5h16" />
          <path d="M9 3.5v3M15 3.5v3" />
          <circle cx="12" cy="14.5" r="3.25" />
          <path d="M12 12.25v2.25l1.25 1.25" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className={iconClassName}>
          <path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4" />
          <circle cx="12" cy="9" r="3.25" />
          <path d="M21 19c0-1.8-1.1-3.3-2.8-3.8" />
          <path d="M17.5 5.3A3 3 0 0 1 18.3 11" />
        </svg>
      );
    case "groups":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className={iconClassName}>
          <circle cx="8" cy="9" r="2.8" />
          <circle cx="16.5" cy="8.5" r="2.3" />
          <path d="M3.5 18c0-2.4 2-4.3 4.5-4.3S12.5 15.6 12.5 18" />
          <path d="M13.2 18c0-1.9 1.6-3.4 3.6-3.4S20.4 16.1 20.4 18" />
        </svg>
      );
    case "roles":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClassName}
        >
          <path d="M12 3.5 6 6v5c0 3.2 2.2 6 6 6.5 3.8-.5 6-3.3 6-6.5V6l-6-2.5Z" />
          <path d="M9.5 12.5v4.2a2.5 2.5 0 0 0 5 0v-4.2" />
        </svg>
      );
    case "content":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className={iconClassName}>
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <path d="M8 9.5h8" />
          <path d="M8 13h8" />
          <path d="M8 16.5h5" />
        </svg>
      );
    case "upload":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className={iconClassName}>
          <path d="M12 15V5" />
          <path d="m8.5 8.5 3.5-3.5 3.5 3.5" />
          <rect x="4" y="15" width="16" height="5" rx="1.5" />
        </svg>
      );
    case "repos":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className={iconClassName}>
          <ellipse cx="12" cy="6" rx="7" ry="2.5" />
          <path d="M5 6v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
          <path d="M5 11v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" />
        </svg>
      );
    default:
      return null;
  }
}

export function ManagementSidebar({ usersCount, groupsCount }: ManagementSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-zinc-200/80 bg-zinc-50/80 md:h-screen md:w-[16.75rem] md:shrink-0 md:border-r md:border-b-0 dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="flex h-full flex-col gap-2 px-3 py-4 md:sticky md:top-0 md:overflow-y-auto md:px-4 md:py-5">
        <Link
          href="/dashboard"
          className="group/brand mb-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-zinc-900 outline-none ring-zinc-400 transition-[transform,box-shadow] duration-300 ease-out hover:bg-zinc-100/90 focus-visible:ring-2 motion-reduce:transition-none dark:text-zinc-100 dark:hover:bg-zinc-900/60"
        >
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-zinc-200/90 bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-out group-hover/brand:scale-[1.03] group-hover/brand:border-zinc-300 group-hover/brand:shadow-md motion-reduce:group-hover/brand:scale-100 dark:border-zinc-700 dark:bg-zinc-900 dark:group-hover/brand:border-zinc-600">
            <Image
              src="/pulp_logo_icon.svg"
              alt="Pulp"
              width={22}
              height={22}
              className="h-[22px] w-[22px] transition-transform duration-300 ease-out group-hover/brand:scale-105 motion-reduce:group-hover/brand:scale-100"
              priority
            />
          </span>
          <span
            suppressHydrationWarning
            className="truncate text-sm font-semibold tracking-tight transition-colors duration-200 group-hover/brand:text-zinc-700 dark:group-hover/brand:text-zinc-200"
          >
            {PROJECT_NAME}
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-5" aria-label="Main navigation">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.hint}
                        className={cn(
                          "group/nav relative flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-sm leading-snug transition-[transform,background-color,color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
                          "hover:translate-x-0.5 motion-reduce:hover:translate-x-0",
                          isActive
                            ? "bg-zinc-200/95 font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                            : "text-zinc-600 hover:bg-zinc-100/90 hover:text-zinc-900 hover:shadow-sm dark:text-zinc-400 dark:hover:bg-zinc-900/80 dark:hover:text-zinc-200"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] origin-center rounded-full bg-zinc-900 transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-zinc-100",
                            isActive ? "scale-y-100" : "scale-y-0 group-hover/nav:scale-y-[0.55]"
                          )}
                        />
                        <span
                          className={cn(
                            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out motion-reduce:transition-none",
                            "group-hover/nav:shadow-md group-hover/nav:-translate-y-px motion-reduce:group-hover/nav:translate-y-0",
                            isActive
                              ? "border-zinc-400/80 bg-white text-zinc-900 shadow-sm dark:border-zinc-500 dark:bg-zinc-900/90 dark:text-zinc-50"
                              : "border-zinc-200/90 bg-white/70 text-zinc-600 group-hover/nav:border-zinc-300 group-hover/nav:bg-white dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400 dark:group-hover/nav:border-zinc-600 dark:group-hover/nav:bg-zinc-800/90"
                          )}
                        >
                          <span className="transition-transform duration-300 ease-out group-hover/nav:scale-105 motion-reduce:group-hover/nav:scale-100">
                            <SidebarIcon name={item.icon} />
                          </span>
                        </span>
                        <span className="relative min-w-0 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

      </div>
    </aside>
  );
}
