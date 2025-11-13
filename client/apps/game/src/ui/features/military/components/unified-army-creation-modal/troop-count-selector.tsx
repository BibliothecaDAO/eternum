import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { AlertTriangle } from "lucide-react";

interface TroopCountSelectorProps {
  troopCount: number;
  maxAffordable: number;
  onChange: (value: number) => void;
  capacityRemaining?: number | null;
  troopMaxSize?: number | null;
}

export const TroopCountSelector = ({
  troopCount,
  maxAffordable,
  onChange,
  capacityRemaining,
  troopMaxSize,
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
    <div className="mt-2 p-2 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-1">
            <Button
              variant="outline"
              onClick={() => handleIncrement(100)}
              disabled={troopCount >= maxAffordable}
              className="px-3 py-1.5 text-xs font-bold hover:bg-gold/10"
            >
              +100
            </Button>
            <Button
              variant="outline"
              onClick={() => handleIncrement(500)}
              disabled={troopCount >= maxAffordable}
              className="px-3 py-1.5 text-xs font-bold hover:bg-gold/10"
            >
              +500
            </Button>
            <Button
              variant="gold"
              onClick={() => onChange(maxAffordable)}
              disabled={troopCount >= maxAffordable}
              className="px-4 py-1.5 text-xs font-extrabold"
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
            className="w-24 h-7 text-sm"
          />
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gold/60">
            Available: <span className="text-gold font-bold">{maxAffordable.toLocaleString()}</span>
          </span>
          {shouldShowCapacityInfo && capacityLimitDisplay !== null && (
            <span className="text-gold/60">
              Capacity: <span className="text-gold/80 font-semibold">{capacityLimitDisplay.toLocaleString()}</span>
            </span>
          )}
        </div>

        {isAtCapacity && maxCapacity !== null && (
          <div className="bg-danger/10 border-l-2 border-danger rounded px-2 py-1 text-xxs text-danger font-semibold">
            Max capacity: {maxCapacity.toLocaleString()}
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
