/**
 * MMR Leaderboard component for the landing page.
 * Fetches player data and MMR from Torii SQL and JSON-RPC without requiring Dojo context.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { hash } from "starknet";

import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability } from "@/hooks/use-world-availability";
import { displayAddress } from "@/ui/utils/utils";
import type { Chain } from "@contracts";

// Batch size for JSON-RPC calls
const BATCH_SIZE = 20;
const AUTO_REFRESH_INTERVAL_MS = 30_000;

// Selector for get_player_mmr function
const GET_PLAYER_MMR_SELECTOR = hash.getSelectorFromName("get_player_mmr");

// SQL queries
const WORLD_CONFIG_QUERY = `SELECT "mmr_config.mmr_token_address" AS mmr_token_address FROM "s1_eternum-WorldConfig" LIMIT 1;`;
const PLAYERS_QUERY = `SELECT r.player AS player, n.name AS name, r.once_registered AS once_registered, p.registered_points AS registered_points FROM "s1_eternum-BlitzRealmPlayerRegister" r LEFT JOIN "s1_eternum-AddressName" n ON r.player = n.address LEFT JOIN "s1_eternum-PlayerRegisteredPoints" p ON r.player = p.address WHERE r.once_registered = TRUE OR r.registered = TRUE;`;

// Helper functions
const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;
const buildRpcUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/katana`;

const toHexString = (value: bigint | number | string): string => {
  if (typeof value === "string") {
    return value.startsWith("0x") ? value : `0x${BigInt(value).toString(16)}`;
  }
  return `0x${BigInt(value).toString(16)}`;
};

const parseMaybeHexToBigInt = (v: unknown): bigint | null => {
  if (v == null) return null;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return BigInt(v);
      return BigInt(v);
    } catch {
      return null;
    }
  }
  return null;
};

const decodePaddedFeltAscii = (felt: string): string | null => {
  if (!felt) return null;
  const trimmed = felt.trim();
  if (!trimmed.length) return null;

  if (!trimmed.startsWith("0x")) return trimmed;

  try {
    const hex = trimmed.slice(2);
    if (hex.length % 2 !== 0) return trimmed;

    let output = "";
    for (let index = 0; index < hex.length; index += 2) {
      const chunk = hex.slice(index, index + 2);
      const charCode = parseInt(chunk, 16);
      if (Number.isInteger(charCode) && charCode > 0 && charCode < 127) {
        output += String.fromCharCode(charCode);
      }
    }
    return output.length ? output : trimmed;
  } catch {
    return trimmed;
  }
};

interface PlayerMMR {
  address: string;
  name: string | null;
  mmr: bigint;
  registeredPoints: bigint;
}

interface MMRLeaderboardState {
  players: PlayerMMR[];
  isLoading: boolean;
  error: string | null;
  selectedWorld: string | null;
  selectedChain: Chain;
}

const CHAIN_OPTIONS: Chain[] = ["mainnet", "slot"];

export const MMRLeaderboard = () => {
  const [state, setState] = useState<MMRLeaderboardState>({
    players: [],
    isLoading: false,
    error: null,
    selectedWorld: null,
    selectedChain: "mainnet",
  });

  // Fetch available worlds from factory
  const { worlds: availableWorlds, isLoading: isLoadingWorlds } = useFactoryWorlds([state.selectedChain], true);

  // Get world availability to check if MMR is enabled
  const worldRefs = useMemo(
    () => availableWorlds.map((w) => ({ name: w.name, chain: state.selectedChain })),
    [availableWorlds, state.selectedChain],
  );
  const { results: worldAvailability, isAnyLoading: isCheckingWorlds } = useWorldsAvailability(worldRefs, true);

  // Filter to only MMR-enabled worlds
  const mmrEnabledWorlds = useMemo(() => {
    return availableWorlds.filter((w) => {
      const availability = worldAvailability.get(`${state.selectedChain}:${w.name}`);
      return availability?.meta?.mmrEnabled;
    });
  }, [availableWorlds, worldAvailability, state.selectedChain]);

  // Auto-select first MMR-enabled world
  useEffect(() => {
    if (!state.selectedWorld && mmrEnabledWorlds.length > 0) {
      setState((prev) => ({ ...prev, selectedWorld: mmrEnabledWorlds[0].name }));
    }
  }, [mmrEnabledWorlds, state.selectedWorld]);

  // Reset selection when chain changes
  useEffect(() => {
    setState((prev) => ({ ...prev, selectedWorld: null, players: [], error: null }));
  }, [state.selectedChain]);

  /**
   * Fetch MMR token address from WorldConfig
   */
  const fetchMMRTokenAddress = async (toriiBaseUrl: string): Promise<string | null> => {
    try {
      const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(WORLD_CONFIG_QUERY)}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const [row] = (await response.json()) as Record<string, unknown>[];
      if (row?.mmr_token_address) {
        const addr = parseMaybeHexToBigInt(row.mmr_token_address);
        if (addr && addr !== 0n) {
          return toHexString(addr);
        }
      }
    } catch {
      // Failed to fetch MMR token address
    }
    return null;
  };

  /**
   * Fetch registered players from Torii
   */
  const fetchRegisteredPlayers = async (
    toriiBaseUrl: string,
  ): Promise<Array<{ address: string; name: string | null; registeredPoints: bigint }>> => {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(PLAYERS_QUERY)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Player query failed: ${response.status}`);
    const rows = (await response.json()) as Record<string, unknown>[];

    return rows
      .map((row) => {
        const addressRaw = row?.player;
        if (addressRaw == null) return null;
        const address = toHexString(parseMaybeHexToBigInt(addressRaw) ?? 0n);
        const name = row?.name ? decodePaddedFeltAscii(String(row.name)) : null;
        const registeredPoints = parseMaybeHexToBigInt(row?.registered_points) ?? 0n;
        return { address, name, registeredPoints };
      })
      .filter((p): p is { address: string; name: string | null; registeredPoints: bigint } => Boolean(p))
      .filter((p) => p.registeredPoints > 0n); // Only include players with points
  };

  /**
   * Fetch MMRs for a batch of players using JSON-RPC batch request
   */
  const fetchMMRBatch = async (
    rpcUrl: string,
    players: Array<{ address: string; name: string | null; registeredPoints: bigint }>,
    tokenAddress: string,
  ): Promise<PlayerMMR[]> => {
    const batchRequest = players.map((player, idx) => ({
      jsonrpc: "2.0",
      id: idx,
      method: "starknet_call",
      params: [
        {
          contract_address: tokenAddress,
          entry_point_selector: GET_PLAYER_MMR_SELECTOR,
          calldata: [player.address],
        },
        "pending",
      ],
    }));

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchRequest),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`);
    }

    const results = await response.json();
    const resultsArray = Array.isArray(results) ? results : [results];

    const playerMMRs: PlayerMMR[] = [];
    for (let idx = 0; idx < players.length; idx++) {
      const player = players[idx];
      const result = resultsArray.find((r: { id: number }) => r.id === idx);

      if (result?.error) {
        // Skip players with errors (might not have MMR yet)
        continue;
      }

      if (!result?.result) {
        continue;
      }

      // u256 is returned as two felts [low, high]
      const resultArray = result.result;
      const low = BigInt(resultArray[0] || "0");
      const high = BigInt(resultArray[1] || "0");
      const mmr = low + (high << 128n);

      playerMMRs.push({
        address: player.address,
        name: player.name,
        mmr,
        registeredPoints: player.registeredPoints,
      });
    }

    return playerMMRs;
  };

  /**
   * Fetch all player MMRs for a world
   */
  const fetchWorldMMRs = useCallback(async (worldName: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const toriiBaseUrl = buildToriiBaseUrl(worldName);
      const rpcUrl = buildRpcUrl(worldName);

      // 1. Fetch MMR token address
      const mmrTokenAddress = await fetchMMRTokenAddress(toriiBaseUrl);
      if (!mmrTokenAddress) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "MMR not configured for this world",
          players: [],
        }));
        return;
      }

      // 2. Fetch registered players
      const registeredPlayers = await fetchRegisteredPlayers(toriiBaseUrl);
      if (registeredPlayers.length === 0) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
          players: [],
        }));
        return;
      }

      // 3. Fetch MMRs in batches
      const allPlayerMMRs: PlayerMMR[] = [];
      for (let i = 0; i < registeredPlayers.length; i += BATCH_SIZE) {
        const batch = registeredPlayers.slice(i, i + BATCH_SIZE);
        try {
          const batchMMRs = await fetchMMRBatch(rpcUrl, batch, mmrTokenAddress);
          allPlayerMMRs.push(...batchMMRs);
        } catch (e) {
          console.warn("Failed to fetch MMR batch:", e);
        }
      }

      // Sort by MMR descending
      const sortedPlayerMMRs = allPlayerMMRs.toSorted((a, b) => {
        if (a.mmr > b.mmr) return -1;
        if (a.mmr < b.mmr) return 1;
        return 0;
      });

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: null,
        players: sortedPlayerMMRs,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load MMR data";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
        players: [],
      }));
    }
  }, []);

  // Fetch MMRs when world is selected
  useEffect(() => {
    if (state.selectedWorld) {
      void fetchWorldMMRs(state.selectedWorld);
    }
  }, [state.selectedWorld, fetchWorldMMRs]);

  // Keep rankings fresh without requiring manual refresh.
  useEffect(() => {
    if (!state.selectedWorld) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchWorldMMRs(state.selectedWorld);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.selectedWorld, fetchWorldMMRs]);

  // Format MMR for display (convert from token units with 18 decimals)
  const formatMMR = (mmr: bigint): string => {
    const mmrValue = mmr / 10n ** 18n;
    return mmrValue.toString();
  };

  const handleChainChange = (chain: Chain) => {
    setState((prev) => ({ ...prev, selectedChain: chain }));
  };

  const handleWorldChange = (worldName: string) => {
    setState((prev) => ({ ...prev, selectedWorld: worldName }));
  };

  const handleRefresh = () => {
    if (state.selectedWorld) {
      void fetchWorldMMRs(state.selectedWorld);
    }
  };

  const isLoadingAny = isLoadingWorlds || isCheckingWorlds || state.isLoading;

  return (
    <div className="h-[85vh] w-full space-y-6 overflow-y-auto rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gold">MMR Rankings</h2>
          <p className="mt-1 text-sm text-gold/60">Player rankings based on Match Making Rating.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoadingAny || !state.selectedWorld}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:border-gold/50 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Selectors - inline */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Chain selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gold/60">Chain:</span>
          <div className="flex gap-1">
            {CHAIN_OPTIONS.map((chain) => (
              <button
                key={chain}
                type="button"
                onClick={() => handleChainChange(chain)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                  state.selectedChain === chain
                    ? "bg-gold/20 text-gold"
                    : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                }`}
              >
                {chain}
              </button>
            ))}
          </div>
        </div>

        {/* World selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gold/60">World:</span>
          {isLoadingWorlds || isCheckingWorlds ? (
            <span className="text-sm text-gold/50">Loading...</span>
          ) : mmrEnabledWorlds.length === 0 ? (
            <span className="text-sm text-gold/50">No MMR-enabled worlds on {state.selectedChain}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {mmrEnabledWorlds.map((world) => (
                <button
                  key={world.name}
                  type="button"
                  onClick={() => handleWorldChange(world.name)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    state.selectedWorld === world.name
                      ? "bg-gold/20 text-gold"
                      : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                  }`}
                >
                  {world.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </div>
      )}

      {/* Loading state */}
      {state.isLoading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!state.isLoading && !state.error && state.players.length === 0 && state.selectedWorld && (
        <div className="flex flex-1 items-center justify-center py-16 text-gold/50">
          No players with MMR found in this world yet.
        </div>
      )}

      {/* Player list */}
      {!state.isLoading && state.players.length > 0 && (
        <div className="flex-1 overflow-hidden rounded-xl border border-gold/10 bg-black/30">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-gold/10 bg-black/80 backdrop-blur-sm">
                <tr className="text-left text-sm text-gold/60">
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Player</th>
                  <th className="px-6 py-4 text-right font-medium">MMR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/5">
                {state.players.map((player, idx) => (
                  <tr key={player.address} className="transition-colors hover:bg-gold/5">
                    <td className="px-6 py-4 text-gold/50">#{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gold">{player.name || displayAddress(player.address)}</span>
                        {player.name && <span className="text-xs text-gold/40">{displayAddress(player.address)}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-lg font-semibold text-gold">{formatMMR(player.mmr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gold/10 bg-black/40 px-6 py-3 text-center text-sm text-gold/50">
            {state.players.length} player{state.players.length !== 1 ? "s" : ""} ranked
          </div>
        </div>
      )}
    </div>
  );
};
