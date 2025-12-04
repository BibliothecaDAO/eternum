import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getFactorySqlBaseUrl } from "@/runtime/world";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";

import { env } from "../../../../../../env";
import { decodePaddedFeltAscii, normalizeHex, parseMaybeHexToNumber } from "./market-utils";

const WORLD_CONFIG_QUERY =
  'SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at, "blitz_registration_config.registration_count" AS registration_count FROM "s1_eternum-WorldConfig" LIMIT 1;';

const PLAYERS_QUERY =
  'SELECT r.player AS player, n.name AS name FROM "s1_eternum-BlitzRealmPlayerRegister" r LEFT JOIN "s1_eternum-AddressName" n ON r.player = n.address WHERE r.once_registered = TRUE OR r.registered = TRUE;';

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const fetchWorldConfigMeta = async (
  toriiBaseUrl: string,
): Promise<{ startMainAt: number | null; endAt: number | null; registrationCount: number | null }> => {
  const meta: { startMainAt: number | null; endAt: number | null; registrationCount: number | null } = {
    startMainAt: null,
    endAt: null,
    registrationCount: null,
  };

  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(WORLD_CONFIG_QUERY)}`;
    const response = await fetch(url);
    if (!response.ok) return meta;
    const [row] = (await response.json()) as any[];
    if (row) {
      meta.startMainAt = parseMaybeHexToNumber(row.start_main_at);
      meta.endAt = parseMaybeHexToNumber(row.end_at);
      meta.registrationCount = parseMaybeHexToNumber(row.registration_count);
    }
  } catch {
    // best-effort metadata; errors handled by callers
  }

  return meta;
};

const fetchRegisteredPlayers = async (
  toriiBaseUrl: string,
): Promise<Array<{ address: string; name: string | null }>> => {
  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(PLAYERS_QUERY)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Player query failed: ${response.status}`);
    const rows = (await response.json()) as any[];

    const players = rows
      .map((row) => {
        const addressRaw = row?.player as string | number | bigint | undefined;
        if (addressRaw == null) return null;
        const address = normalizeHex(addressRaw as any);
        const name = row?.name ? decodePaddedFeltAscii(String(row.name)) : null;
        return { address, name };
      })
      .filter((p): p is { address: string; name: string | null } => Boolean(p));

    players.sort((a, b) => {
      const aLabel = (a.name || a.address).toLowerCase();
      const bLabel = (b.name || b.address).toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

    return players;
  } catch (error: any) {
    const message = error?.message ?? "Failed to fetch players";
    throw new Error(message);
  }
};

export type MarketPlayer = { address: string; name: string | null };

export type MarketServer = {
  name: string;
  toriiBaseUrl: string;
  startAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  players: MarketPlayer[];
  playersLoaded: boolean;
  loadingPlayers: boolean;
  playerError: string | null;
};

export const useMarketServers = () => {
  const [servers, setServers] = useState<MarketServer[]>([]);
  const serversRef = useRef<MarketServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const factorySqlBaseUrl = getFactorySqlBaseUrl(env.VITE_PUBLIC_CHAIN as any);
      if (!factorySqlBaseUrl) {
        setServers([]);
        return;
      }

      const queryUrl = `${factorySqlBaseUrl}?query=${encodeURIComponent('SELECT name FROM [wf-WorldDeployed] LIMIT 300;')}`;
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error(`Factory query failed: ${res.statusText}`);
      const rows = (await res.json()) as any[];

      const names = rows
        .map((row) => row?.name || row?.["data.name"] || row?.data?.name)
        .filter(Boolean)
        .map((felt: string) => decodePaddedFeltAscii(String(felt)))
        .filter((name: string, idx: number, arr: string[]) => Boolean(name) && arr.indexOf(name) === idx);

      const nextServers: MarketServer[] = [];
      const limit = 6;
      let index = 0;

      const worker = async () => {
        while (index < names.length) {
          const i = index++;
          const name = names[i];
          const toriiBaseUrl = buildToriiBaseUrl(name);

          let online = false;
          try {
            online = await isToriiAvailable(toriiBaseUrl);
          } catch {
            online = false;
          }
          if (!online) continue;

          const meta = await fetchWorldConfigMeta(toriiBaseUrl);
          nextServers.push({
            name,
            toriiBaseUrl,
            startAt: meta.startMainAt,
            endAt: meta.endAt,
            registrationCount: meta.registrationCount,
            players: [],
            playersLoaded: false,
            loadingPlayers: false,
            playerError: null,
          });
        }
      };

      const workers = Array.from({ length: limit }, () => worker());
      await Promise.all(workers);

      nextServers.sort((a, b) => {
        const aStart = a.startAt ?? Infinity;
        const bStart = b.startAt ?? Infinity;
        return aStart - bStart;
      });

      setServers(nextServers);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadPlayers = useCallback(async (serverName: string) => {
    const server = serversRef.current.find((s) => s.name === serverName);
    if (!server) return;

    setServers((prev) =>
      prev.map((s) => (s.name === serverName ? { ...s, loadingPlayers: true, playerError: null } : s)),
    );

    try {
      const players = await fetchRegisteredPlayers(server.toriiBaseUrl);
      setServers((prev) =>
        prev.map((s) => (s.name === serverName ? { ...s, players, playersLoaded: true, loadingPlayers: false } : s)),
      );
    } catch (e: any) {
      const message = e?.message ?? "Failed to load players";
      setServers((prev) =>
        prev.map((s) => (s.name === serverName ? { ...s, playerError: message, loadingPlayers: false } : s)),
      );
    }
  }, []);

  const registrationTotal = useMemo(() => {
    return servers.reduce((acc, server) => acc + (server.registrationCount ?? 0), 0);
  }, [servers]);

  return {
    servers,
    loading,
    error,
    nowSec,
    refresh,
    loadPlayers,
    registrationTotal,
  };
};
