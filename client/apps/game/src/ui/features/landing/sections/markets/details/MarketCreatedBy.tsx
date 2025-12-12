import { useEffect, useMemo, useState, type ReactNode } from "react";

import { getContractByName } from "@dojoengine/core";

import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { useTokens } from "@/pm/hooks/dojo/useTokens";
import { useMarketActivity } from "@/pm/hooks/social/useMarketActivity";
import { formatUnits } from "@/pm/utils";
import { MaybeController } from "../MaybeController";
import { TokenIcon } from "../TokenIcon";

const formatTimeLeft = (targetMs: number | null, now: number) => {
  if (targetMs == null || targetMs <= 0) return "N/A";
  const diff = targetMs - now;
  if (diff <= 0) return "Ended";

  const totalSeconds = Math.floor(diff / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const StatPill = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs">
    <div className="text-[11px] uppercase tracking-[0.08em] text-gold/60">{label}</div>
    <div className="mt-1 text-sm font-semibold text-white">{value}</div>
  </div>
);

export const MarketCreatedBy = ({ creator, market }: { creator?: string; market: MarketClass }) => {
  if (!creator) return null;

  const {
    config: { manifest },
  } = useDojoSdk();

  const [now, setNow] = useState(() => Date.now());

  const positionIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id || 0)), [market.position_ids]);

  const vaultPositionsAddress = useMemo(() => getContractByName(manifest, "pm", "VaultPositions")?.address, [manifest]);

  const { marketBuys } = useMarketActivity(market.market_id);

  const { balances } = useTokens(
    {
      accountAddresses: undefined,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
    },
    false,
  );

  const holdersCount = useMemo(() => {
    if (!vaultPositionsAddress || positionIds.length === 0) return null;
    const holders = new Set<string>();

    balances.forEach((balance) => {
      if (BigInt(balance.balance || 0) === 0n) return;
      const isPositionToken = positionIds.some((id) => BigInt(balance.token_id || 0) === id);
      if (!isPositionToken) return;
      holders.add(balance.account_address);
    });

    return holders.size;
  }, [balances, positionIds, vaultPositionsAddress]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const tradingEndsLabel = useMemo(
    () => formatTimeLeft(market.end_at ? market.end_at * 1_000 : null, now),
    [market.end_at, now],
  );

  const resolutionLabel = useMemo(
    () => formatTimeLeft(market.resolve_at ? market.resolve_at * 1_000 : null, now),
    [market.resolve_at, now],
  );

  const volumeLabel = useMemo(() => {
    const decimals = Number(market.collateralToken?.decimals ?? 18);
    const totalVolume = marketBuys.reduce((acc, buy) => acc + BigInt(buy.amount || 0), 0n);
    const formatted = formatUnits(totalVolume, decimals, 2);

    return (
      <span className="inline-flex items-center gap-1">
        {formatted}
        <TokenIcon token={market.collateralToken} size={14} />
      </span>
    );
  }, [market.collateralToken, marketBuys]);

  const liquidityLabel = useMemo(() => {
    const liquidity = market.getTvl();
    if (!liquidity || liquidity === "0.00") return "0";
    return (
      <span className="inline-flex items-center gap-1">
        {liquidity}
        <TokenIcon token={market.collateralToken} size={14} />
      </span>
    );
  }, [market]);

  return (
    <div className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-gold/70 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-gold/60">Created By</div>
          <div className="mt-1 text-white">
            <MaybeController address={creator} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <StatPill label="Liquidity" value={liquidityLabel} />
          <StatPill label="Volume" value={volumeLabel} />
          <StatPill label="Holders" value={holdersCount != null ? holdersCount.toString() : "--"} />
          <StatPill label="Trading ends in" value={tradingEndsLabel} />
          <StatPill label="Resolves in" value={resolutionLabel} />
        </div>
      </div>
    </div>
  );
};
