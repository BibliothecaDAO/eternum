import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFactoryWorldNames, getFactorySqlBaseUrl, toriiBaseUrlFromName, type Chain } from "@bibliothecadao/world";

import { getAvailabilityStatus, useWorldsAvailability } from "./use-world-availability";

export type FactoryWorldStatus = "checking" | "ok" | "fail";

export interface FactoryWorldGame {
  name: string;
  status: FactoryWorldStatus;
  toriiBaseUrl: string;
  startMainAt: number | null;
  endAt: number | null;
}

export interface FactoryWorldCategories {
  ongoing: FactoryWorldGame[];
  upcoming: FactoryWorldGame[];
  ended: FactoryWorldGame[];
  offline: FactoryWorldGame[];
}

export interface UseFactoryWorldsListOptions {
  chain: Chain;
  cartridgeApiBase?: string;
  limit?: number;
  enabled?: boolean;
}

export const useFactoryWorldsList = ({
  chain,
  cartridgeApiBase,
  limit = 200,
  enabled = true,
}: UseFactoryWorldsListOptions) => {
  const [factoryNames, setFactoryNames] = useState<string[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  const {
    results: availabilityByName,
    isAnyLoading: availabilityLoading,
    refetchAll: refetchAvailability,
  } = useWorldsAvailability(factoryNames, enabled && factoryNames.length > 0, { cartridgeApiBase });

  const games = useMemo<FactoryWorldGame[]>(() => {
    return factoryNames.map((name) => {
      const availability = availabilityByName.get(name);
      const status = getAvailabilityStatus(availability);
      return {
        name,
        status,
        toriiBaseUrl: toriiBaseUrlFromName(name, cartridgeApiBase),
        startMainAt: availability?.meta?.startMainAt ?? null,
        endAt: availability?.meta?.endAt ?? null,
      };
    });
  }, [availabilityByName, cartridgeApiBase, factoryNames]);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    try {
      setNamesLoading(true);
      setError(null);

      const factorySqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
      if (!factorySqlBaseUrl) {
        setFactoryNames([]);
        return;
      }

      const names = await fetchFactoryWorldNames(factorySqlBaseUrl, limit);
      setFactoryNames(names);
      await refetchAvailability();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      setError(message);
    } finally {
      setNamesLoading(false);
    }
  }, [cartridgeApiBase, chain, enabled, limit, refetchAvailability]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = useMemo<FactoryWorldCategories>(() => {
    const ongoing: FactoryWorldGame[] = [];
    const upcoming: FactoryWorldGame[] = [];
    const ended: FactoryWorldGame[] = [];
    const offline: FactoryWorldGame[] = [];

    for (const game of games) {
      if (game.status !== "ok") {
        offline.push(game);
        continue;
      }

      const start = game.startMainAt;
      const end = game.endAt;
      const isEnded = start != null && end != null && end !== 0 && nowSec >= end;
      const isOngoing = start != null && nowSec >= start && (end == null || end === 0 || nowSec < end);
      const isUpcoming = start != null && nowSec < start;

      if (isOngoing) ongoing.push(game);
      else if (isUpcoming) upcoming.push(game);
      else if (isEnded) ended.push(game);
      else offline.push(game);
    }

    upcoming.sort((a, b) => (a.startMainAt ?? Infinity) - (b.startMainAt ?? Infinity));
    ongoing.sort((a, b) => {
      const aEnd = a.endAt && a.endAt > nowSec ? a.endAt : Infinity;
      const bEnd = b.endAt && b.endAt > nowSec ? b.endAt : Infinity;
      return aEnd - bEnd;
    });
    ended.sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0));

    return { ongoing, upcoming, ended, offline };
  }, [games, nowSec]);

  const loading = namesLoading || (factoryNames.length > 0 && availabilityLoading);

  return {
    games,
    categories,
    loading,
    error,
    refresh,
    nowSec,
  };
};
