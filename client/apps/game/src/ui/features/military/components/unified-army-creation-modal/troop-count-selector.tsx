import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

interface TroopCountSelectorProps {
  troopCount: number;
  maxAffordable: number;
  onChange: (value: number) => void;
  capacityRemaining?: number | null;
  troopMaxSize?: number | null;
  /**
   * Embed mode: drop the "Available troops" line — the MAX TROOPS summary in
   * the parent body already covers that info.
   */
  embedded?: boolean;
}

export const TroopCountSelector = ({
  troopCount,
  maxAffordable,
  onChange,
  capacityRemaining,
  troopMaxSize,
  embedded = false,
}: TroopCountSelectorProps) => {
  const capacityLimit =
    typeof capacityRemaining === "number" && Number.isFinite(capacityRemaining) ? capacityRemaining : null;
  const capacityLimitDisplay = capacityLimit !== null ? Math.max(0, Math.floor(capacityLimit)) : null;
  const maxCapacity =
    typeof troopMaxSize === "number" && Number.isFinite(troopMaxSize) && troopMaxSize > 0 ? troopMaxSize : null;
  const isAtCapacity = maxCapacity !== null && capacityLimit !== null && capacityLimit <= 0;
  const shouldShowCapacityInfo =
    maxCapacity !== null && capacityLimit !== null && capacityLimit > 0 && capacityLimit < maxCapacity;

  const handleIncrement = (amount: number) => {
    onChange(Math.min(troopCount + amount, maxAffordable));
  };

  return (
    <div
      className={
        embedded
          ? "p-1"
          : "mt-2 p-2 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20"
      }
    >
      <div className="space-y-1.5">
        {/*
          Two rows: quick-add buttons on top, the editable count input on its
          own full-width row below. In the narrow embedded panel a single row
          (buttons + a fixed-width input) squeezed the NumberInput down to just
          its arrows, so the typed count was invisible/unusable. Giving the
          input its own row lets its native full-width layout render the value.
        */}
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            onClick={() => handleIncrement(100)}
            disabled={troopCount >= maxAffordable}
            className="flex-1 px-2 py-1.5 text-xs font-bold hover:bg-gold/10"
          >
            +100
          </Button>
          <Button
            variant="outline"
            onClick={() => handleIncrement(500)}
            disabled={troopCount >= maxAffordable}
            className="flex-1 px-2 py-1.5 text-xs font-bold hover:bg-gold/10"
          >
            +500
          </Button>
          <Button
            variant="gold"
            onClick={() => onChange(maxAffordable)}
            disabled={troopCount >= maxAffordable}
            className="flex-1 px-2 py-1.5 text-xs font-extrabold"
          >
            MAX
          </Button>
        </div>
        <NumberInput
          max={maxAffordable}
          min={0}
          step={100}
          value={troopCount}
          onChange={onChange}
          className="h-9 text-sm"
        />

        {!embedded && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gold/60">
              Available troops: <span className="text-gold font-bold">{maxAffordable.toLocaleString()}</span>
            </span>
            {shouldShowCapacityInfo && capacityLimitDisplay !== null && (
              <span className="text-gold/60">
                Cap remaining: <span className="text-gold/80 font-semibold">{capacityLimitDisplay.toLocaleString()}</span>
              </span>
            )}
          </div>
        )}

        {isAtCapacity && maxCapacity !== null && (
          <div className="bg-danger/10 border-l-2 border-danger rounded px-2 py-1 text-xxs text-danger font-semibold">
            Deployment cap reached: {maxCapacity.toLocaleString()} troops
          </div>
        )}

        {troopCount > maxAffordable && (
          <div className="bg-danger/10 border-l-2 border-danger rounded px-2 py-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
            <span className="text-xxs text-danger font-semibold">
              Need {troopCount.toLocaleString()} but only {maxAffordable.toLocaleString()} available
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
