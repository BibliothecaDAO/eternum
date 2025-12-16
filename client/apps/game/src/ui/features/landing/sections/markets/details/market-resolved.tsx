import { useMemo } from "react";

import { MarketClass } from "@/pm/class";
import { formatUint256 } from "@/pm/utils";
import { HStack, VStack } from "@pm/ui";
import { CheckCircle2, TrendingUp } from "lucide-react";

import { MaybeController } from "../maybe-controller";

export function MarketResolved({
  market,
  className,
  ...props
}: {
  market: MarketClass;
} & React.ComponentProps<"div">) {
  const outcomes = market.getMarketTextOutcomes();

  const payouts = useMemo(() => {
    switch (market.typ.activeVariant()) {
      case "Binary":
        return [
          {
            index: 0,
            name: outcomes[0],
            payoutNumerator: market.conditionResolution?.payout_numerators?.[0]
              ? BigInt(market.conditionResolution.payout_numerators[0])
              : 0n,
          },
          {
            index: 1,
            name: outcomes[1],
            payoutNumerator: market.conditionResolution?.payout_numerators?.[1]
              ? BigInt(market.conditionResolution.payout_numerators[1])
              : 0n,
          },
        ];
      case "Categorical":
        return market.odds?.map((odds, idx) => {
          return {
            index: idx,
            name: outcomes[idx],
            payoutNumerator: market.conditionResolution?.payout_numerators?.[idx]
              ? BigInt(market.conditionResolution.payout_numerators[idx])
              : 0n,
          };
        });
    }
    return [];
  }, [market]);

  if (!market || !payouts || !market.odds) return null;

  return (
    <div
      className={`w-full rounded-lg border border-white/10 bg-black/40 p-4 shadow-inner ${className ?? ""}`}
      {...props}
    >
      <VStack className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-progress-bar-good">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold uppercase tracking-[0.08em] text-progress-bar-good">Resolved</span>
          </div>
          <div className="text-xs text-gold/70">Oracle outcome posted. Winning selections are highlighted below.</div>
        </div>

        {market.typBinary() && !market.typBinaryScalar() ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {payouts.map((payout, idx) => {
              const won = payout.payoutNumerator > 0n;
              const odds = market.odds ? Number(market.odds[idx]) : 0;
              const edge = market.odds ? Math.ceil((Number(market.odds[1 - idx]) / Number(odds || 1)) * 100) : 0;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border px-3 py-3 ${
                    won
                      ? "border-progress-bar-good/60 bg-progress-bar-good/10"
                      : "border-white/10 bg-white/5 opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-semibold">{idx === 0 ? "YES" : "NO"}</span>
                    <span className="flex items-center gap-2 text-xs text-gold/70">
                      <TrendingUp className="h-3 w-3" />
                      {edge}%
                    </span>
                  </div>
                  {won ? (
                    <div className="mt-2 text-xs font-semibold text-progress-bar-good">Winner</div>
                  ) : (
                    <div className="mt-2 text-xs text-gold/60">Lost</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {market.typBinary() && market.typBinaryScalar() ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            <div className="text-xs uppercase tracking-[0.08em] text-gold/70">Scalar outcome</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {payouts[0].payoutNumerator > 0n && payouts[1].payoutNumerator === 0n
                ? `< ${formatUint256(market.typBinaryScalar().low, 18)}`
                : payouts[1].payoutNumerator > 0n && payouts[0].payoutNumerator === 0n
                  ? `< ${formatUint256(market.typBinaryScalar().high, 18)}`
                  : `${
                      (BigInt(market.typBinaryScalar().low) +
                        ((BigInt(market.typBinaryScalar().high) - BigInt(market.typBinaryScalar().low)) *
                          BigInt(payouts[1].payoutNumerator)) /
                          10_000n) /
                      10n ** 18n
                    }`}
            </div>
          </div>
        ) : null}

        {market.typCategorical() ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {payouts.map((payout, idx) => {
              if (payout.payoutNumerator === 0n) return null;
              const upsidePercent = Math.ceil((100 / Number(market.odds![idx] || 1)) * 100);
              return (
                <div
                  key={idx}
                  className="flex flex-col gap-2 rounded-lg border border-progress-bar-good/50 bg-progress-bar-good/10 p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <MaybeController address={payout.name} className="text-white" />
                    <span className="flex items-center gap-1 text-xs text-gold/70">
                      <TrendingUp className="h-3 w-3" />
                      {upsidePercent}%
                    </span>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-progress-bar-good">Winner</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </VStack>
    </div>
  );
}
