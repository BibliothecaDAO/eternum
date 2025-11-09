import { useCallback, useEffect, useState } from "react";

import {
  fetchScoreToBeatAcrossEndpoints,
  type ScoreToBeatEntrySummary,
  type ScoreToBeatResult,
} from "./landing-leaderboard-service";

const SCORE_TO_BEAT_REFRESH_INTERVAL_MS = 120_000;

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

const sanitizeInputEndpoints = (endpoints: string[]): string[] => {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  endpoints.forEach((endpoint) => {
    const trimmed = endpoint.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    sanitized.push(trimmed);
  });

  return sanitized;
};

export const useScoreToBeat = (endpoints: string[], refreshIntervalMs: number = SCORE_TO_BEAT_REFRESH_INTERVAL_MS) => {
  const [scoreToBeatState, setScoreToBeatState] = useState<ScoreToBeatState>(buildInitialState);

  useEffect(() => {
    console.log("rascheltest4", scoreToBeatState);
  }, [scoreToBeatState]);

  const refresh = useCallback(async () => {
    console.log("rascheltest6");
    if (!endpoints.length) {
      setScoreToBeatState((previous) => ({
        ...previous,
        entries: [],
        endpoints: [],
        failedEndpoints: [],
        lastUpdatedAt: null,
        isLoading: false,
        error: null,
      }));
      return;
    }

    setScoreToBeatState((previous) => ({ ...previous, isLoading: true, error: null }));

    try {
      const result: ScoreToBeatResult = await fetchScoreToBeatAcrossEndpoints(endpoints, {
        perEndpointLimit: 50,
        runsToAggregate: 2,
        maxPlayers: 10,
      });

      console.log("rascheltest3", result);

      setScoreToBeatState({
        entries: result.entries,
        endpoints: result.endpoints,
        failedEndpoints: result.failedEndpoints,
        lastUpdatedAt: result.generatedAt,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.log("rascheltest5", error);

      const message = error instanceof Error ? error.message : "Unable to load score to beat.";
      setScoreToBeatState((previous) => ({ ...previous, isLoading: false, error: message }));
    }
  }, [endpoints]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (refreshIntervalMs <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [refresh, refreshIntervalMs]);

  return {
    ...scoreToBeatState,
    refresh,
    hasEndpointsConfigured: endpoints.length > 0,
  };
};

export const SCORE_TO_BEAT_REFRESH_INTERVAL = SCORE_TO_BEAT_REFRESH_INTERVAL_MS;
