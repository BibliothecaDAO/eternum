import { useMemo } from "react";

import { MarketClass, MarketOutcome } from "@/pm/class";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { MaybeController } from "./maybe-controller";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const getOddsValue = (outcome: MarketOutcome) =>
  (outcome as any)?.odds ?? (outcome as any)?.price ?? (outcome as any)?.odds;

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

interface OddsBarChartProps {
  market: MarketClass;
  maxVisible?: number;
  showExpand?: boolean;
  animated?: boolean;
}

/**
 * Visual bar chart display of market odds.
 * Shows outcomes as horizontal progress bars with percentages.
 */
export const OddsBarChart = ({ market, maxVisible = 5, animated = true }: OddsBarChartProps) => {
  const outcomes = useMemo(() => getOutcomes(market), [market]);

  // DEBUG: Log market outcomes for landing page
  console.log("[Landing OddsBarChart] market.getMarketOutcomes():", market.getMarketOutcomes());

  const { sortedOutcomes, winningOutcomeOrdersSet } = useMemo(() => {
    const resolvedPayouts = market.isResolved() ? (market.conditionResolution?.payout_numerators ?? []) : [];
    const winningOutcomeOrders = resolvedPayouts
      .map((payout, idx) => (payout != null && Number(payout) > 0 ? idx : null))
      .filter((idx): idx is number => idx !== null);
    const winningSet = new Set(winningOutcomeOrders);

    const baseSorted = outcomes
      .map((outcome, idx) => {
        const normalizedOrder = Number((outcome as any)?.index);
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
            ...baseSorted.filter(({ order }) => winningSet.has(order)),
            ...baseSorted.filter(({ order }) => !winningSet.has(order)),
          ]
        : baseSorted;

    return { sortedOutcomes: sorted, winningOutcomeOrdersSet: winningSet };
  }, [outcomes, market]);

  if (outcomes.length === 0) {
    return <p className="text-xs text-gold/70">No odds available.</p>;
  }

  const visibleOutcomes = sortedOutcomes.slice(0, maxVisible);
  const hiddenCount = sortedOutcomes.length - maxVisible;

  return (
    <div className="space-y-2">
      {visibleOutcomes.map(({ outcome, order }, index) => {
        const oddsRaw = getOddsValue(outcome);
        const oddsNum = Number(oddsRaw);
        const oddsPercent = Number.isFinite(oddsNum) ? oddsNum : 0;
        const color = getOutcomeColor(order);
        const isWinner = market.isResolved() && winningOutcomeOrdersSet.size > 0 && winningOutcomeOrdersSet.has(order);

        return (
          <div key={(outcome as any)?.id ?? order} className="group">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span
                className={cx(
                  "flex items-center gap-1.5 truncate",
                  isWinner ? "font-semibold text-brilliance" : "text-gold/80",
                )}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <MaybeController address={outcome.name} />
                {isWinner && <span className="text-[10px] text-brilliance">(Winner)</span>}
              </span>
              <span
                className={cx("ml-2 flex-shrink-0 font-mono font-medium", isWinner ? "text-brilliance" : "text-gold")}
              >
                {oddsPercent > 0 ? `${oddsPercent < 1 ? oddsPercent.toFixed(2) : oddsPercent.toFixed(1)}%` : "--"}
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-brown/60">
              <div
                className={cx(
                  "absolute inset-y-0 left-0 rounded-full",
                  animated && "transition-all duration-500 ease-out",
                  isWinner && "ring-1 ring-brilliance/50",
                )}
                style={{
                  width: `${Math.min(oddsPercent, 100)}%`,
                  backgroundColor: color,
                  transitionDelay: animated ? `${index * 75}ms` : "0ms",
                }}
              />
            </div>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <p className="pt-1 text-[10px] text-gold/50">
          +{hiddenCount} more outcome{hiddenCount > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};
