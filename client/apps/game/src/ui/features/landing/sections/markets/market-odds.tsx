import { MarketClass, MarketOutcome } from "@/pm/class";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { HStack } from "@pm/ui";
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

export const MarketOdds = ({
  market,
  selectable = false,
  onSelect,
  selectedOutcomeIndex,
}: {
  market: MarketClass;
  selectable?: boolean;
  onSelect?: (outcome: MarketOutcome) => void;
  selectedOutcomeIndex?: number;
}) => {
  const outcomes = getOutcomes(market);
  const resolvedPayouts = market.isResolved() ? (market.conditionResolution?.payout_numerators ?? []) : [];
  const winningOutcomeOrders = resolvedPayouts
    .map((payout, idx) => (payout != null && Number(payout) > 0 ? idx : null))
    .filter((idx): idx is number => idx !== null);
  const winningOutcomeOrdersSet = new Set(winningOutcomeOrders);

  const baseSortedOutcomes = [...outcomes]
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

  const sortedOutcomes =
    market.isResolved() && winningOutcomeOrders.length > 0
      ? [
          // Move winning outcome(s) to the top once resolution is known.
          ...baseSortedOutcomes.filter(({ order }) => winningOutcomeOrdersSet.has(order)),
          ...baseSortedOutcomes.filter(({ order }) => !winningOutcomeOrdersSet.has(order)),
        ]
      : baseSortedOutcomes;

  if (outcomes.length === 0) {
    return <p className="text-xs text-gold/70">No odds available.</p>;
  }

  const isSelectable = selectable && !market.isEnded() && !market.isResolved();

  return (
    <div className="flex flex-col gap-2">
      {sortedOutcomes.map(({ outcome, order }) => {
        const oddsRaw = getOddsValue(outcome);
        const odds = formatOdds(oddsRaw);
        const isSelected = isSelectable && selectedOutcomeIndex === order;
        const color = getOutcomeColor(order);
        const isWinner = market.isResolved() && resolvedPayouts.length > 0 && winningOutcomeOrdersSet.has(order);

        return (
          <button
            key={(outcome as any)?.id ?? order}
            className={cx(
              "flex min-h-[52px] items-center justify-between rounded-sm border px-3 py-2 text-left text-xs transition",
              isWinner ? "border-progress-bar-good/60 bg-progress-bar-good/10" : "border-gold/20 bg-brown/40",
              "text-lightest",
              isSelectable ? "cursor-pointer hover:border-gold/60 hover:bg-gold/10" : "cursor-default",
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
            <HStack className="gap-2 text-lightest">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <MaybeController address={outcome.name} className="max-w-[220px] truncate" />
            </HStack>
            <div className="flex items-center gap-2">
              <span className={isWinner ? "text-progress-bar-good" : "text-gold"}>{odds ?? "--"}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
