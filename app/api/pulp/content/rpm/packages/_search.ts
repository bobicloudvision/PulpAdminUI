import { pulpFetch, type PulpAuth } from "@/lib/pulp";
import { PulpRpmPackageSearchRow } from "@/services/pulp/types";

/**
 * RPM package search with a fallback for older pulp_rpm (< 3.2x), whose PackageFilter only
 * supports exact `name` matching. When `name__contains` is rejected we scan a lightweight,
 * short-lived per-user index of all packages and filter it here (case-insensitive).
 */

export type RpmSearchMatchMode = "server" | "index";

export type RpmSearchResult = {
  count: number;
  next: null;
  previous: null;
  results: PulpRpmPackageSearchRow[];
  match: RpmSearchMatchMode;
  /** True when the index hit MAX_INDEX_ROWS and results may be incomplete. */
  index_truncated: boolean;
};

type PulpPage<T> = { count: number; next: string | null; results: T[] };

type Failure = { ok: false; status: number; detail: string };

const SHA256_RE = /^[a-f0-9]{64}$/i;

const FIELDS = [
  "pulp_href",
  "pulp_created",
  "name",
  "epoch",
  "version",
  "release",
  "arch",
  "location_href",
] as const;

const INDEX_PAGE_SIZE = 1000;
const MAX_INDEX_ROWS = 100_000;
const INDEX_TTL_MS = 60_000;

/** null = unknown yet; detected on first search and remembered for the process lifetime. */
let serverSubstringFilter: boolean | null = null;

type IndexResult = { ok: true; rows: PulpRpmPackageSearchRow[]; truncated: boolean } | Failure;

type IndexEntry = {
  builtAt: number;
  promise: Promise<IndexResult>;
};

// Keyed by username: visible content depends on the user's permissions.
const indexCache = new Map<string, IndexEntry>();

function withFields(qs: URLSearchParams): URLSearchParams {
  for (const field of FIELDS) {
    qs.append("fields", field);
  }
  return qs;
}

function isInvalidFilter(failure: Failure): boolean {
  return failure.status === 400 && /invalid filter/i.test(failure.detail);
}

function nevra(row: PulpRpmPackageSearchRow): string {
  const epoch = row.epoch && row.epoch !== "0" ? `${row.epoch}:` : "";
  return `${row.name}-${epoch}${row.version}-${row.release}.${row.arch}`;
}

async function buildIndex(auth: PulpAuth): Promise<IndexResult> {
  const rows: PulpRpmPackageSearchRow[] = [];
  let offset = 0;

  for (;;) {
    const qs = withFields(new URLSearchParams({ limit: String(INDEX_PAGE_SIZE), offset: String(offset) }));
    const page = await pulpFetch<PulpPage<PulpRpmPackageSearchRow>>(`/content/rpm/packages/?${qs}`, auth);
    if (!page.ok) {
      return page;
    }
    rows.push(...page.data.results);
    offset += page.data.results.length;

    if (!page.data.next || page.data.results.length === 0) {
      return { ok: true, rows, truncated: false };
    }
    if (rows.length >= MAX_INDEX_ROWS) {
      return { ok: true, rows, truncated: true };
    }
  }
}

function getIndex(auth: PulpAuth): Promise<IndexResult> {
  const cached = indexCache.get(auth.username);
  if (cached && Date.now() - cached.builtAt < INDEX_TTL_MS) {
    return cached.promise;
  }

  const promise = buildIndex(auth).then((result) => {
    if (!result.ok) {
      indexCache.delete(auth.username); // don't cache failures
    }
    return result;
  });
  indexCache.set(auth.username, { builtAt: Date.now(), promise });
  return promise;
}

async function searchIndex(
  auth: PulpAuth,
  term: string,
  limit: number,
  offset: number
): Promise<{ ok: true; data: RpmSearchResult } | Failure> {
  const index = await getIndex(auth);
  if (!index.ok) {
    return index;
  }

  const needle = term.toLowerCase();
  const rank = (row: PulpRpmPackageSearchRow) => {
    const name = row.name.toLowerCase();
    return name === needle ? 0 : name.startsWith(needle) ? 1 : 2;
  };

  const matches = index.rows
    .filter((row) => row.name.toLowerCase().includes(needle) || nevra(row).toLowerCase().includes(needle))
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.name.localeCompare(b.name) ||
        b.pulp_created.localeCompare(a.pulp_created)
    );

  return {
    ok: true,
    data: {
      count: matches.length,
      next: null,
      previous: null,
      results: matches.slice(offset, offset + limit),
      match: "index",
      index_truncated: index.truncated,
    },
  };
}

export async function searchRpmPackages(
  auth: PulpAuth,
  term: string,
  limit: number,
  offset: number
): Promise<{ ok: true; data: RpmSearchResult } | Failure> {
  const qs = withFields(new URLSearchParams({ limit: String(limit), offset: String(offset) }));

  if (SHA256_RE.test(term)) {
    qs.set("sha256", term.toLowerCase());
  } else if (serverSubstringFilter === false) {
    return searchIndex(auth, term, limit, offset);
  } else {
    qs.set("name__contains", term);
    qs.set("ordering", "name");
  }

  const result = await pulpFetch<PulpPage<PulpRpmPackageSearchRow>>(`/content/rpm/packages/?${qs}`, auth);
  if (!result.ok) {
    if (qs.has("name__contains") && isInvalidFilter(result)) {
      serverSubstringFilter = false;
      return searchIndex(auth, term, limit, offset);
    }
    return result;
  }

  if (qs.has("name__contains")) {
    serverSubstringFilter = true;
  }

  return {
    ok: true,
    data: {
      count: result.data.count,
      next: null,
      previous: null,
      results: result.data.results,
      match: "server",
      index_truncated: false,
    },
  };
}
