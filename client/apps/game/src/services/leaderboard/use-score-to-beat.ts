import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchScoreToBeatAcrossEndpoints,
  type ScoreToBeatEntrySummary,
  type ScoreToBeatResult,
} from "./landing-leaderboard-service";

const SCORE_TO_BEAT_REFRESH_INTERVAL_MS = 300_000;

type ScoreToBeatState = {
  entries: ScoreToBeatEntrySummary[];
  endpoints: string[];
  failedEndpoints: string[];
  lastUpdatedAt: number | null;
  isLoading: boolean;
  error: string | null;
};

const buildInitialState = (): ScoreToBeatState => ({
  entries: [],
  endpoints: [],
  failedEndpoints: [],
  lastUpdatedAt: null,
  isLoading: false,
  error: null,
});

const normalizeEndpointInputs = (endpoints: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  endpoints.forEach((endpoint) => {
    const trimmed = endpoint.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized.toSorted((a, b) => a.localeCompare(b));
};

export const useScoreToBeat = (
  endpoints: string[],
  runsToAggregate: number = 2,
  refreshIntervalMs: number = SCORE_TO_BEAT_REFRESH_INTERVAL_MS,
) => {
  const [scoreToBeatState, setScoreToBeatState] = useState<ScoreToBeatState>(buildInitialState);
  const inFlightRef = useRef(false);
  const stableEndpointsKey = JSON.stringify(normalizeEndpointInputs(endpoints));
  const hasEndpointsConfigured = stableEndpointsKey !== "[]";

  const refresh = useCallback(async () => {
    const stableEndpoints = JSON.parse(stableEndpointsKey) as string[];

    if (!hasEndpointsConfigured) {
      setScoreToBeatState((previous) => {
        if (
          previous.entries.length === 0 &&
          previous.endpoints.length === 0 &&
          previous.failedEndpoints.length === 0 &&
          previous.lastUpdatedAt === null &&
          previous.isLoading === false &&
          previous.error === null
        ) {
          return previous;
        }

        return {
          entries: [],
          endpoints: [],
          failedEndpoints: [],
          lastUpdatedAt: null,
          isLoading: false,
          error: null,
        };
      });
      return;
    }

    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    setScoreToBeatState((previous) =>
      previous.isLoading && previous.error === null ? previous : { ...previous, isLoading: true, error: null },
    );

    try {
      const result: ScoreToBeatResult = await fetchScoreToBeatAcrossEndpoints(stableEndpoints, {
        perEndpointLimit: 50,
        runsToAggregate,
        maxPlayers: 10,
      });

      setScoreToBeatState({
        entries: result.entries,
        endpoints: result.endpoints,
        failedEndpoints: result.failedEndpoints,
        lastUpdatedAt: result.generatedAt,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load score to beat.";
      setScoreToBeatState((previous) => ({ ...previous, isLoading: false, error: message }));
    } finally {
      inFlightRef.current = false;
    }
  }, [hasEndpointsConfigured, runsToAggregate, stableEndpointsKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (refreshIntervalMs <= 0 || !hasEndpointsConfigured) {
      return;
    }

    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void refresh();
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [hasEndpointsConfigured, refresh, refreshIntervalMs]);

  return {
    ...scoreToBeatState,
    refresh,
    hasEndpointsConfigured,
  };
};
