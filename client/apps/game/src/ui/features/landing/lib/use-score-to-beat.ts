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

export const useScoreToBeat = (
  endpoints: string[],
  runsToAggregate: number = 2,
  refreshIntervalMs: number = SCORE_TO_BEAT_REFRESH_INTERVAL_MS,
) => {
  const [scoreToBeatState, setScoreToBeatState] = useState<ScoreToBeatState>(buildInitialState);

  const refresh = useCallback(async () => {
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
    }
  }, [endpoints, runsToAggregate]);

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
