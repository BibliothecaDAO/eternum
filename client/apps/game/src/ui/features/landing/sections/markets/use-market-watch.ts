import { useCallback, useState } from "react";

import { MarketClass } from "@/pm/class";
import { buildWorldProfile, getFactorySqlBaseUrl, patchManifestWithFactory } from "@/runtime/world";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import { Chain, getGameManifest } from "@contracts";
import { toast } from "sonner";

import { decodePaddedFeltAscii } from "./market-utils";
import { env } from "../../../../../../env";

const FACTORY_WORLD_QUERY = "SELECT name FROM [wf-WorldDeployed] LIMIT 300;";
const toriiBaseUrlFromName = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const normalizeHex = (value: unknown): string | null => {
  try {
    return `0x${BigInt(value as any).toString(16)}`;
  } catch {
    return null;
  }
};

const getPrizeDistributionAddress = (market: MarketClass): string | null => {
  const params: any[] = (market as any).oracle_params || [];
  if (!Array.isArray(params) || params.length < 2) return null;
  const prize = normalizeHex(params[1]);
  return prize === "0x0" ? null : prize;
};

const worldNamesByChain = new Map<string, Promise<string[]>>();
const prizeAddressByWorld = new Map<string, string | null>();
const worldByPrizeAddress = new Map<string, Promise<string | null>>();

const fetchWorldNames = async (chain: Chain): Promise<string[]> => {
  const cacheKey = String(chain);
  const cached = worldNamesByChain.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
    if (!factorySqlBaseUrl) return [];

    const queryUrl = `${factorySqlBaseUrl}?query=${encodeURIComponent(FACTORY_WORLD_QUERY)}`;
    const res = await fetch(queryUrl);
    if (!res.ok) throw new Error(`Factory query failed: ${res.statusText}`);
    const rows = (await res.json()) as any[];

    return rows
      .map((row) => row?.name || row?.["data.name"] || row?.data?.name)
      .filter(Boolean)
      .map((felt: string) => decodePaddedFeltAscii(String(felt)))
      .filter((name: string, idx: number, arr: string[]) => Boolean(name) && arr.indexOf(name) === idx);
  })().catch((error) => {
    console.error("[market-watch] Failed to load worlds from factory", error);
    worldNamesByChain.delete(cacheKey);
    return [];
  });

  worldNamesByChain.set(cacheKey, promise);
  return promise;
};

const resolvePrizeAddressForWorld = async (
  chain: Chain,
  worldName: string,
  baseManifest: unknown,
): Promise<string | null> => {
  if (prizeAddressByWorld.has(worldName)) return prizeAddressByWorld.get(worldName) ?? null;

  try {
    const profile = await buildWorldProfile(chain, worldName);
    const patchedManifest = patchManifestWithFactory(
      baseManifest as any,
      profile.worldAddress,
      profile.contractsBySelector,
    );
    const prizeContract = (patchedManifest as any)?.contracts?.find(
      (contract: any) => contract.tag === "s1_eternum-prize_distribution_systems",
    );
    const prizeAddress = normalizeHex(prizeContract?.address);
    if (prizeAddress === "0x0") {
      prizeAddressByWorld.set(worldName, null);
      return null;
    }
    prizeAddressByWorld.set(worldName, prizeAddress);
    return prizeAddress;
  } catch (error) {
    console.error("[market-watch] Failed to inspect world", worldName, error);
    return null;
  }
};

export const resolveMarketWorldName = async (market: MarketClass): Promise<string | null> => {
  const chain = env.VITE_PUBLIC_CHAIN as Chain;
  const fallbackName = (market.title || "").replace(/<br\s*\/?>/gi, " ").trim() || null;
  const prizeAddress = getPrizeDistributionAddress(market);
  if (!prizeAddress) return fallbackName;

  const normalizedPrize = normalizeHex(prizeAddress);
  if (!normalizedPrize || normalizedPrize === "0x0") return fallbackName;

  const cached = worldByPrizeAddress.get(normalizedPrize);
  if (cached) return cached;

  const promise = (async () => {
    const worldNames = await fetchWorldNames(chain);
    if (worldNames.length === 0) return fallbackName;
    const baseManifest = getGameManifest(chain);

    const limit = 4;
    let index = 0;
    let matched: string | null = null;

    const worker = async () => {
      while (matched == null && index < worldNames.length) {
        const currentIdx = index++;
        const worldName = worldNames[currentIdx];
        const candidatePrize = await resolvePrizeAddressForWorld(chain, worldName, baseManifest);
        if (!candidatePrize) continue;

        if (candidatePrize === normalizedPrize) {
          matched = worldName;
          return;
        }
      }
    };

    await Promise.all(Array.from({ length: limit }, () => worker()));
    return matched || fallbackName;
  })();

  worldByPrizeAddress.set(normalizedPrize, promise);
  return promise;
};

export const useMarketWatch = () => {
  const [watchingMarketId, setWatchingMarketId] = useState<string | null>(null);
  const [watchStates, setWatchStates] = useState<Record<
    string,
    { status: "idle" | "checking" | "ready" | "offline"; worldName?: string }
  >>({});

  const updateWatchState = useCallback(
    (marketId: string, next: Partial<{ status: "idle" | "checking" | "ready" | "offline"; worldName?: string }>) => {
      setWatchStates((prev) => ({
        ...prev,
        [marketId]: { status: "idle", ...prev[marketId], ...next },
      }));
    },
    [],
  );

  const checkWatchability = useCallback(
    async (market: MarketClass): Promise<string | null> => {
      const marketId = String(market.market_id ?? "");
      updateWatchState(marketId, { status: "checking" });

      try {
        const worldName = await resolveMarketWorldName(market);
        if (!worldName) {
          updateWatchState(marketId, { status: "offline", worldName: undefined });
          return null;
        }

        const online = await isToriiAvailable(toriiBaseUrlFromName(worldName));
        updateWatchState(marketId, { status: online ? "ready" : "offline", worldName });
        return online ? worldName : null;
      } catch {
        updateWatchState(marketId, { status: "offline" });
        return null;
      }
    },
    [updateWatchState],
  );

  const getWatchState = useCallback(
    (market: MarketClass) => {
      const marketId = String(market.market_id ?? "");
      const state = watchStates[marketId];
      if (!state) void checkWatchability(market);
      return state ?? { status: "idle" as const };
    },
    [checkWatchability, watchStates],
  );

  const watchMarket = useCallback(async (market: MarketClass) => {
    const marketId = String(market.market_id ?? "");
    setWatchingMarketId(marketId);

    try {
      const worldName = await checkWatchability(market);
      if (!worldName) {
        toast.error("This game is offline or unavailable.");
        return;
      }

      const chain = env.VITE_PUBLIC_CHAIN as Chain;
      await buildWorldProfile(chain, worldName);

      const playUrl = `/play/${encodeURIComponent(worldName)}`;
      const newTab = window.open(playUrl, "_blank", "noopener,noreferrer");
      if (!newTab) {
        toast.error("Enable pop-ups to watch this game.");
      }
    } catch (error) {
      console.error("[market-watch] Failed to open game for market", error);
      toast.error("Failed to open the game for this market.");
    } finally {
      setWatchingMarketId((current) => (current === marketId ? null : current));
    }
  }, [checkWatchability]);

  return {
    watchMarket,
    watchingMarketId,
    getWatchState,
  };
};
