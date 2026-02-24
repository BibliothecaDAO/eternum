import { useMemo, useState } from "react";

import { MarketClass, MarketOutcome } from "@/pm/class";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { formatUnits } from "@/pm/utils";
import { MaybeController } from "./maybe-controller";
import { TokenIcon } from "./token-icon";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const formatOdds = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  // Values from MarketClass are already percentages (e.g., 0.95 = 0.95%, 95.23 = 95.23%)
  if (num < 1) return `${num.toFixed(2)}%`; // Show 2 decimals for small percentages
  return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
};

const getOddsValue = (outcome: MarketOutcome) => outcome.odds;

const getOutcomes = (market: MarketClass): MarketOutcome[] => {
  const outcomes = market.getMarketOutcomes();
  if (!Array.isArray(outcomes)) return [];
  return outcomes as MarketOutcome[];
};

const parseNumericOdds = (outcome: MarketOutcome) => {
  const oddsValue = getOddsValue(outcome);
  if (oddsValue == null) return null;

  const numericOdds = Number(oddsValue);
  return Number.isFinite(numericOdds) ? numericOdds : null;
};

export const MarketOdds = ({
  market,
  selectable = false,
  onSelect,
  selectedOutcomeIndex,
  maxVisible,
  collapsible = false,
}: {
  market: MarketClass;
  selectable?: boolean;
  onSelect?: (outcome: MarketOutcome) => void;
  selectedOutcomeIndex?: number;
  maxVisible?: number;
  collapsible?: boolean;
}) => {
  const outcomes = useMemo(() => getOutcomes(market), [market]);
  const [isExpanded, setIsExpanded] = useState(false);

  const { sortedOutcomes, winningOutcomeOrdersSet } = useMemo(() => {
    const resolvedPayouts = market.isResolved() ? (market.conditionResolution?.payout_numerators ?? []) : [];
    const winningOutcomeOrders = resolvedPayouts
      .map((payout, idx) => (payout != null && Number(payout) > 0 ? idx : null))
      .filter((idx): idx is number => idx !== null);
    const winningSet = new Set(winningOutcomeOrders);

    const baseSorted = outcomes
      .map((outcome, idx) => {
        const normalizedOrder = Number(outcome.index);
        return { outcome, order: Number.isFinite(normalizedOrder) ? normalizedOrder : idx };
      })
      .toSorted((a, b) => {
        const aOdds = parseNumericOdds(a.outcome);
        const bOdds = parseNumericOdds(b.outcome);

        if (aOdds == null && bOdds == null) return a.order - b.order;
        if (aOdds == null) return 1;
        if (bOdds == null) return -1;
        if (aOdds === bOdds) return a.order - b.order;
        return bOdds - aOdds;
      });

    const sorted =
      market.isResolved() && winningOutcomeOrders.length > 0
        ? [
            // Move winning outcome(s) to the top once resolution is known.
            ...baseSorted.filter(({ order }) => winningSet.has(order)),
            ...baseSorted.filter(({ order }) => !winningSet.has(order)),
          ]
        : baseSorted;

    return { sortedOutcomes: sorted, winningOutcomeOrdersSet: winningSet };
  }, [outcomes, market]);

  if (outcomes.length === 0) {
    return <p className="text-xs text-gold/70">No odds available.</p>;
  }

  const isSelectable = selectable && !market.isEnded() && !market.isResolved();
  const shouldCollapse = collapsible && typeof maxVisible === "number" && maxVisible > 0 && sortedOutcomes.length > maxVisible;
  const visibleOutcomes = shouldCollapse && !isExpanded ? sortedOutcomes.slice(0, maxVisible) : sortedOutcomes;

  return (
    <div className="flex flex-col gap-2">
      {visibleOutcomes.map(({ outcome, order }) => {
        const oddsRaw = getOddsValue(outcome);
        const odds = formatOdds(oddsRaw);
        const isSelected = isSelectable && selectedOutcomeIndex === order;
        const color = getOutcomeColor(order);
        const isWinner = market.isResolved() && winningOutcomeOrdersSet.size > 0 && winningOutcomeOrdersSet.has(order);

        // Get pool amount for this outcome
        const vaultNumerators = market.vaultNumerators ?? [];
        const numeratorEntry = vaultNumerators.find((entry) => Number(entry.index) === order);
        const poolAmountRaw = numeratorEntry?.value ?? 0n;
        const decimals = market.collateralToken?.decimals ?? 18;
        const poolAmount = formatUnits(poolAmountRaw, Number(decimals), 0);

        // Calculate pool share percentage for visual bar
        const totalPool = Number(market.vaultDenominator?.value ?? 0n);
        const outcomePool = Number(poolAmountRaw);
        const poolSharePercent = totalPool > 0 ? (outcomePool / totalPool) * 100 : 0;

        return (
          <button
            key={`${outcome.index}-${order}`}
            className={cx(
              "group relative flex min-h-[56px] items-center justify-between overflow-hidden rounded-sm border px-3 py-2.5 text-left text-xs transition-all duration-200",
              isWinner ? "border-progress-bar-good/60 bg-progress-bar-good/10" : "border-gold/20 bg-brown/40",
              "text-lightest",
              isSelectable ? "cursor-pointer hover:border-gold/50 hover:bg-gold/10" : "cursor-default",
              isSelected ? "border-gold/70 bg-gold/15 ring-1 ring-gold/40" : null,
            )}
            type="button"
            onClick={
              isSelectable && onSelect
                ? () => {
                    onSelect(outcome);
                  }
                : undefined
            }
          >
            {/* Pool share background bar */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 opacity-20 transition-all duration-500"
              style={{
                width: `${Math.min(poolSharePercent, 100)}%`,
                backgroundColor: color,
              }}
            />

            {/* Content */}
            <div className="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-lightest">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-white/10"
                style={{ backgroundColor: color }}
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                <MaybeController address={outcome.name} />
              </span>
            </div>

            {/* Pool amount & Odds */}
            <div className="relative flex flex-shrink-0 items-center gap-2 pl-2">
              {/* Pool amount pill */}
              <div className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 backdrop-blur-sm">
                <span className="text-[10px] font-medium tabular-nums text-gold/70">{poolAmount}</span>
                <TokenIcon token={market.collateralToken} size={11} />
              </div>

              {/* Odds badge */}
              <div
                className={cx(
                  "min-w-[48px] rounded px-2 py-1 text-center text-sm font-bold tabular-nums",
                  isWinner
                    ? "bg-progress-bar-good/20 text-progress-bar-good"
                    : "bg-gold/10 text-gold group-hover:bg-gold/20",
                )}
              >
                {odds ?? "--"}
              </div>
            </div>
          </button>
        );
      })}

      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
        >
          {isExpanded ? "Show Top 4" : `Show All Players (${sortedOutcomes.length})`}
        </button>
      ) : null}
    </div>
  );
};
