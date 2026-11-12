"use client";

import { useEffect, useState } from "react";
import { pulpContentService } from "@/services/pulp/content-service";
import { PulpRpmPackageSearchResponse, PulpRpmPackageSearchRow } from "@/services/pulp/types";

type SearchState = {
  key: string;
  items: PulpRpmPackageSearchRow[];
  count: number;
  match: PulpRpmPackageSearchResponse["match"] | null;
  indexTruncated: boolean;
  error: string | null;
};

/** Paginated RPM package search; inactive (no requests) while `search` is empty. */
export function usePulpRpmPackageSearch(enabled: boolean, search: string, limit = 20) {
  const term = search.trim();
  const [pageState, setPageState] = useState({ term, offset: 0 });
  // A new term always starts from the first page.
  const offset = pageState.term === term ? pageState.offset : 0;

  const requestKey = `${term}|${offset}|${limit}`;
  const [state, setState] = useState<SearchState | null>(null);

  useEffect(() => {
    if (!enabled || !term) {
      return;
    }

    let active = true;
    pulpContentService
      .searchRpmPackages(term, limit, offset)
      .then((page) => {
        if (active) {
          setState({
            key: requestKey,
            items: page.results,
            count: page.count,
            match: page.match,
            indexTruncated: page.index_truncated,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            key: requestKey,
            items: [],
            count: 0,
            match: null,
            indexTruncated: false,
            error: error instanceof Error ? error.message : "Search failed.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [enabled, term, limit, offset, requestKey]);

  const isActive = enabled && term.length > 0;
  const current = state?.key === requestKey ? state : null;
  const loading = isActive && current === null;
  // While a new page/term loads, keep showing the last successful results (dimmed by the UI).
  const shown = current ?? (state && !state.error ? state : null);
  const count = shown?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const page = Math.floor(offset / limit) + 1;

  return {
    active: isActive,
    loading,
    /** True while loading and `results` still holds the previous request's rows. */
    stale: loading && shown !== null,
    error: current?.error ?? null,
    results: shown?.items ?? [],
    match: shown?.match ?? null,
    indexTruncated: shown?.indexTruncated ?? false,
    count,
    page,
    totalPages,
    canGoNext: !loading && page < totalPages,
    canGoPrevious: !loading && offset > 0,
    goNext: () => setPageState({ term, offset: offset + limit }),
    goPrevious: () => setPageState({ term, offset: Math.max(0, offset - limit) }),
  };
}
