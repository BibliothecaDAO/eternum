import type { Market, MarketOutcome } from "@pm/sdk";
import { HStack } from "@pm/ui";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const formatOdds = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > 0 && num <= 1) return `${(num * 100).toFixed(1)}%`;
  if (num >= 1 && num <= 100) return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
  return num.toFixed(2);
};

const getOutcomes = (market: Market): MarketOutcome[] => {
  const outcomes = (market as any).outcomes;
  if (!Array.isArray(outcomes)) return [];
  return outcomes as MarketOutcome[];
};

export const MarketOdds = ({
  market,
  selectable = false,
  onClick,
}: {
  market: Market;
  selectable?: boolean;
  onClick?: () => void;
}) => {
  const outcomes = getOutcomes(market);

  if (outcomes.length === 0) {
    return <p className="text-xs text-gold/70">No odds available.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {outcomes.map((outcome, idx) => {
        const label = outcome?.label || (outcome as any)?.name || `Outcome ${idx + 1}`;
        const odds = formatOdds(outcome?.probability ?? (outcome as any)?.price ?? (outcome as any)?.odds);

        return (
          <div
            key={(outcome as any)?.id ?? idx}
            className={cx(
              "flex items-center justify-between rounded-sm border border-white/5 bg-white/5 px-3 py-2 text-xs transition",
              selectable ? "cursor-pointer hover:border-gold/50 hover:bg-white/10" : "cursor-default",
            )}
            onClick={selectable ? onClick : undefined}
          >
            <HStack className="gap-2 text-white/90">
              <span className="text-sm">{label}</span>
            </HStack>
            <span className="text-gold">{odds ?? "--"}</span>
          </div>
        );
      })}
    </div>
  );
};
