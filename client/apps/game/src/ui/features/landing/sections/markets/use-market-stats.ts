import { ClauseBuilder, ToriiQueryBuilder, type SchemaType, type StandardizedQueryResult } from "@dojoengine/sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

import type { MarketBuy, PayoutRedemption } from "@/pm/bindings";
import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { formatUnits } from "@/pm/utils";

export type MarketLeaderboardRange = "daily" | "weekly" | "monthly" | "all";

const TIMEFRAME_WINDOWS_MS: Record<MarketLeaderboardRange, number | null> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
  all: null,
};

export type EnrichedMarketBuy = MarketBuy & { timestampMs: number };
export type EnrichedPayoutRedemption = PayoutRedemption & { timestampMs: number };

const normalizeHex = (value: unknown): string | null => {
  try {
    return `0x${BigInt(value as any).toString(16)}`;
  } catch {
    return null;
  }
};

const toNumericAmount = (value: unknown, decimals: number) => {
  const formatted = formatUnits(typeof value === "bigint" ? value : String(value ?? 0), decimals, 6);
  const asNumber = Number(formatted);
  return Number.isFinite(asNumber) ? asNumber : 0;
};

const isWithinRange = (timestampMs: number, range: MarketLeaderboardRange) => {
  const windowMs = TIMEFRAME_WINDOWS_MS[range];
  if (!windowMs) return true;
  return timestampMs >= Date.now() - windowMs;
};

export type LeaderboardEntry = {
  address: string;
  earned: number;
  volume: number;
  trades: number;
  markets: number;
  lastActive: number;
  collateralToken?: { symbol?: string; decimals?: number | string | bigint };
};

export type PlayerMarketBreakdown = {
  marketId: string;
  market?: MarketClass;
  volume: number;
  earned: number;
  pnl: number;
  lastActivity: number;
};

export type PlayerSummary = {
  address: string | null;
  volume: number;
  earned: number;
  pnl: number;
  marketsParticipated: number;
  activeMarkets: number;
  markets: PlayerMarketBreakdown[];
};

export const useMarketEventsSnapshot = () => {
  const { sdk } = useDojoSdk();
  const [isLoading, setIsLoading] = useState(false);
  const [buys, setBuys] = useState<EnrichedMarketBuy[]>([]);
  const [payouts, setPayouts] = useState<EnrichedPayoutRedemption[]>([]);

  const buyQuery = useMemo(
    () =>
      new ToriiQueryBuilder()
        .addEntityModel("pm-MarketBuy")
        .withClause(new ClauseBuilder().keys(["pm-MarketBuy"], [undefined], "VariableLen").build())
        .withLimit(2_000)
        .addOrderBy("timestamp", "Desc")
        .includeHashedKeys(),
    [],
  );

  const payoutQuery = useMemo(
    () =>
      new ToriiQueryBuilder()
        .addEntityModel("pm-PayoutRedemption")
        .withClause(new ClauseBuilder().keys(["pm-PayoutRedemption"], [undefined], "VariableLen").build())
        .withLimit(2_000)
        // .addOrderBy("timestamp", "Desc")
        .includeHashedKeys(),
    [],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [buysRes, payoutsRes] = await Promise.all([
        sdk.getEventMessages({ query: buyQuery }),
        sdk.getEventMessages({ query: payoutQuery }),
      ]);

      const buyItems: StandardizedQueryResult<SchemaType> = buysRes.getItems();
      const nextBuys = buyItems
        .flatMap((item) => {
          const event = item.models.pm.MarketBuy as MarketBuy | undefined;
          if (!event) return [];
          const ts = Number((event as any).timestamp ?? 0);
          return [
            {
              ...event,
              timestampMs: Number.isFinite(ts) ? ts * 1_000 : 0,
            },
          ];
        })
        .sort((a, b) => b.timestampMs - a.timestampMs);

      const payoutItems: StandardizedQueryResult<SchemaType> = payoutsRes.getItems();
      const nextPayouts = payoutItems
        .flatMap((item) => {
          const event = item.models.pm.PayoutRedemption as PayoutRedemption | undefined;
          if (!event) return [];
          const ts = Number((event as any).timestamp ?? 0);
          return [
            {
              ...event,
              timestampMs: Number.isFinite(ts) ? ts * 1_000 : 0,
            },
          ];
        })
        .sort((a, b) => b.timestampMs - a.timestampMs);

      setBuys(nextBuys);
      setPayouts(nextPayouts);
    } catch (error) {
      console.error("[pm] Failed to fetch market stats", error);
    } finally {
      setIsLoading(false);
    }
  }, [buyQuery, payoutQuery, sdk]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    buys,
    payouts,
    isLoading,
    refresh,
  };
};

export const buildLeaderboard = ({
  markets,
  buys,
  payouts,
  range,
  getRegisteredToken,
}: {
  markets: MarketClass[];
  buys: EnrichedMarketBuy[];
  payouts: EnrichedPayoutRedemption[];
  range: MarketLeaderboardRange;
  getRegisteredToken?: (address?: string) => { decimals?: number | string | bigint };
}): LeaderboardEntry[] => {
  const marketById = new Map<string, MarketClass>();
  markets.forEach((market) => {
    const id = normalizeHex(market.market_id);
    if (id) {
      marketById.set(id, market);
    }
  });

  const scores = new Map<string, LeaderboardEntry>();
  const marketsByAddress = new Map<string, Set<string>>();

  const touchMarket = (address: string, marketId?: string | null) => {
    if (!marketId) return;
    const existing = marketsByAddress.get(address) ?? new Set<string>();
    existing.add(marketId);
    marketsByAddress.set(address, existing);
  };

  const addVolume = (address: string, marketId: string | null, amount: number, timestamp: number) => {
    const existing = scores.get(address) ?? {
      address,
      earned: 0,
      volume: 0,
      trades: 0,
      markets: 0,
      lastActive: 0,
      collateralToken: undefined,
    };

    touchMarket(address, marketId);

    const next = {
      ...existing,
      volume: existing.volume + amount,
      trades: existing.trades + 1,
      lastActive: Math.max(existing.lastActive, timestamp),
    };
    scores.set(address, next);
  };

  const addEarnings = (address: string, amount: number, timestamp: number) => {
    const existing = scores.get(address) ?? {
      address,
      earned: 0,
      volume: 0,
      trades: 0,
      markets: 0,
      lastActive: 0,
      collateralToken: undefined,
    };
    scores.set(address, {
      ...existing,
      earned: existing.earned + amount,
      lastActive: Math.max(existing.lastActive, timestamp),
    });
  };

  buys.forEach((buy) => {
    if (!isWithinRange(buy.timestampMs, range)) return;
    const rawAddress = buy.account_address;
    if (!rawAddress) return;
    const address = addAddressPadding(rawAddress.toLowerCase());
    const marketId = normalizeHex(buy.market_id);
    const market = marketId ? marketById.get(marketId) : undefined;
    const decimals = market?.collateralToken?.decimals ?? 18;
    const amount = toNumericAmount(buy.amount_in ?? buy.amount ?? 0, Number(decimals));
    addVolume(address, marketId, amount, buy.timestampMs);
    if (market?.collateralToken) {
      const current = scores.get(address);
      scores.set(address, {
        ...(current ?? { address, earned: 0, volume: 0, trades: 0, markets: 0, lastActive: 0 }),
        collateralToken: market.collateralToken,
      });
    }
  });

  payouts.forEach((payout) => {
    if (!isWithinRange(payout.timestampMs, range)) return;
    const rawAddress = payout.redeemer;
    if (!rawAddress) return;
    const address = addAddressPadding(rawAddress.toLowerCase());
    const registeredToken = getRegisteredToken ? getRegisteredToken(payout.collateral_token) : undefined;
    const decimals = registeredToken ? Number(registeredToken.decimals ?? 18) : 18;
    const amount = toNumericAmount(payout.payout ?? 0, decimals);
    addEarnings(address, amount, payout.timestampMs);
    if (registeredToken) {
      const current = scores.get(address);
      scores.set(address, {
        ...(current ?? { address, earned: 0, volume: 0, trades: 0, markets: 0, lastActive: 0 }),
        collateralToken: registeredToken,
      });
    }
  });

  return Array.from(scores.values())
    .map((entry) => ({
      ...entry,
      markets: marketsByAddress.get(entry.address)?.size ?? entry.markets,
    }))
    .sort((a, b) => {
      if (b.earned !== a.earned) return b.earned - a.earned;
      return b.volume - a.volume;
    })
    .slice(0, 25);
};

export const buildPlayerSummary = ({
  address,
  markets,
  buys,
  payouts,
  getRegisteredToken,
}: {
  address: string | null | undefined;
  markets: MarketClass[];
  buys: EnrichedMarketBuy[];
  payouts: EnrichedPayoutRedemption[];
  getRegisteredToken?: (address?: string) => { decimals?: number | string | bigint };
}): PlayerSummary => {
  const normalized = address ? addAddressPadding(address.toLowerCase()) : null;

  const marketById = new Map<string, MarketClass>();
  markets.forEach((market) => {
    const id = normalizeHex(market.market_id);
    if (id) {
      marketById.set(id, market);
    }
  });

  const perMarket = new Map<string, { market?: MarketClass; volume: number; earned: number; lastActivity: number }>();

  if (!normalized) {
    return {
      address: null,
      volume: 0,
      earned: 0,
      pnl: 0,
      marketsParticipated: 0,
      activeMarkets: 0,
      markets: [],
    };
  }

  buys.forEach((buy) => {
    const rawAddress = buy.account_address;
    if (!rawAddress || addAddressPadding(rawAddress.toLowerCase()) !== normalized) return;
    const marketId = normalizeHex(buy.market_id);
    if (!marketId) return;

    const market = marketById.get(marketId);
    const decimals = market?.collateralToken?.decimals ?? 18;
    const amount = toNumericAmount(buy.amount_in ?? buy.amount ?? 0, Number(decimals));

    const entry = perMarket.get(marketId) ?? {
      market,
      volume: 0,
      earned: 0,
      lastActivity: 0,
    };

    perMarket.set(marketId, {
      ...entry,
      market: entry.market || market,
      volume: entry.volume + amount,
      lastActivity: Math.max(entry.lastActivity, buy.timestampMs),
    });
  });

  payouts.forEach((payout) => {
    const rawAddress = payout.redeemer;
    if (!rawAddress || addAddressPadding(rawAddress.toLowerCase()) !== normalized) return;
    const conditionId = normalizeHex(payout.condition_id);
    const marketMatch = conditionId
      ? markets.find((candidate) => normalizeHex(candidate.condition_id) === conditionId)
      : undefined;
    const marketId = marketMatch ? normalizeHex(marketMatch.market_id) : null;

    const decimals = getRegisteredToken ? Number(getRegisteredToken(payout.collateral_token)?.decimals ?? 18) : 18;
    const amount = toNumericAmount(payout.payout ?? 0, decimals);

    const key = marketId ?? conditionId ?? payout.collateral_token;
    const entry = perMarket.get(key) ?? {
      market: marketMatch,
      volume: 0,
      earned: 0,
      lastActivity: 0,
    };

    perMarket.set(key, {
      ...entry,
      market: entry.market || marketMatch,
      earned: entry.earned + amount,
      lastActivity: Math.max(entry.lastActivity, payout.timestampMs),
    });
  });

  const marketsList: PlayerMarketBreakdown[] = Array.from(perMarket.entries()).map(([marketId, details]) => ({
    marketId,
    market: details.market,
    volume: details.volume,
    earned: details.earned,
    pnl: details.earned - details.volume,
    lastActivity: details.lastActivity,
  }));

  const knownMarkets = marketsList.filter((entry) => entry.market);
  const activeMarkets = knownMarkets.filter((entry) => entry.market && !entry.market.isResolved()).length;
  const totalVolume = knownMarkets.reduce((acc, curr) => acc + curr.volume, 0);
  const totalEarned = knownMarkets.reduce((acc, curr) => acc + curr.earned, 0);

  return {
    address: normalized,
    volume: totalVolume,
    earned: totalEarned,
    pnl: totalEarned - totalVolume,
    marketsParticipated: knownMarkets.length,
    activeMarkets,
    markets: knownMarkets.sort((a, b) => b.lastActivity - a.lastActivity),
  };
};
