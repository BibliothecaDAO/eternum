import { MarketClass, MarketOutcome } from "@/pm/class";
import { HStack } from "@pm/ui";
import { MaybeController } from "./MaybeController";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const formatOdds = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > 0 && num <= 1) return `${(num * 100).toFixed(1)}%`;
  if (num >= 1 && num <= 100) return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
  return num.toFixed(2);
};

const getOutcomes = (market: MarketClass): MarketOutcome[] => {
  const outcomes = market.getMarketOutcomes();
  if (!Array.isArray(outcomes)) return [];
  return outcomes as MarketOutcome[];
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

  if (outcomes.length === 0) {
    return <p className="text-xs text-gold/70">No odds available.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {outcomes.map((outcome, idx) => {
        const odds = formatOdds(outcome?.odds ?? (outcome as any)?.price ?? (outcome as any)?.odds);

        return (
          <button
            key={(outcome as any)?.id ?? idx}
            className={cx(
              "flex items-center justify-between rounded-sm border border-white/5 bg-white/5 px-3 py-2 text-left text-xs transition",
              selectable
                ? "cursor-pointer hover:border-gold/50 hover:bg-white/10"
                : "cursor-default",
              selectable && selectedOutcomeIndex === idx ? "border-gold/60 bg-white/10 ring-1 ring-gold/40" : null,
            )}
            type="button"
            onClick={
              selectable && onSelect
                ? () => {
                    onSelect(outcome);
                  }
                : undefined
            }
          >
            <HStack className="gap-2 text-white/90">
              <MaybeController address={outcome.name} />
            </HStack>
            <span className="text-gold">{odds ?? "--"}</span>
          </button>
        );
      })}
    </div>
  );
};
