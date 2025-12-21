import { MarketClass, type MarketOutcome } from "@/pm/class";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { useMemo } from "react";
import { MaybeController } from "./maybe-controller";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const formatOdds = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > 0 && num <= 1) return `${(num * 100).toFixed(1)}%`;
  if (num >= 1 && num <= 100) return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
  return num.toFixed(2);
};

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

interface MarketOddsProps {
  market: MarketClass;
  selectable?: boolean;
  onSelect?: (outcome: MarketOutcome) => void;
  selectedOutcomeIndex?: number;
}

export const MarketOdds = ({ market, selectable = false, onSelect, selectedOutcomeIndex }: MarketOddsProps) => {
  const outcomes = useMemo(() => getOutcomes(market), [market]);

  const { sortedOutcomes, winningOutcomeOrdersSet } = useMemo(() => {
    const resolvedPayouts = market.isResolved() ? (market.conditionResolution?.payout_numerators ?? []) : [];
    const winningOutcomeOrders = resolvedPayouts
      .map((payout, idx) => (payout != null && Number(payout) > 0 ? idx : null))
      .filter((idx): idx is number => idx !== null);
    const winningSet = new Set(winningOutcomeOrders);

    const baseSorted = [...outcomes]
      .map((outcome, idx) => {
        const normalizedOrder = Number((outcome as any)?.index);
        return { outcome, order: Number.isFinite(normalizedOrder) ? normalizedOrder : idx };
      })
      .sort((a, b) => {
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
    return <p className="text-xs text-muted-foreground">No odds available.</p>;
  }

  const isSelectable = selectable && !market.isEnded() && !market.isResolved();

  return (
    <div className="flex flex-col gap-2">
      {sortedOutcomes.map(({ outcome, order }) => {
        const oddsRaw = getOddsValue(outcome);
        const odds = formatOdds(oddsRaw);
        const isSelected = isSelectable && selectedOutcomeIndex === order;
        const color = getOutcomeColor(order);
        const isWinner = market.isResolved() && winningOutcomeOrdersSet.size > 0 && winningOutcomeOrdersSet.has(order);

        return (
          <button
            key={(outcome as any)?.id ?? order}
            className={cx(
              "flex min-h-[52px] items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
              isWinner ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/60 bg-card/80",
              isSelectable ? "cursor-pointer hover:border-primary/60" : "cursor-default",
              isSelected ? "border-primary/80 bg-primary/10 ring-1 ring-primary/30" : null,
            )}
            type="button"
            onClick={isSelectable && onSelect ? () => onSelect(outcome) : undefined}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <MaybeController address={outcome.name} className="max-w-[200px] truncate" />
            </div>
            <span className={isWinner ? "text-emerald-300" : "text-foreground"}>{odds ?? "--"}</span>
          </button>
        );
      })}
    </div>
  );
};
