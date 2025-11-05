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
    <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
      <div className="space-y-4">
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleIncrement(100)}
            disabled={troopCount >= maxAffordable}
            className="px-4 py-2 font-semibold hover:bg-gold/10 transition-all duration-200"
          >
            +100
          </Button>
          <Button
            variant="outline"
            onClick={() => handleIncrement(500)}
            disabled={troopCount >= maxAffordable}
            className="px-4 py-2 font-semibold hover:bg-gold/10 transition-all duration-200"
          >
            +500
          </Button>
          <Button
            variant="gold"
            onClick={() => onChange(maxAffordable)}
            disabled={troopCount >= maxAffordable}
            className="px-6 py-2 font-bold shadow-md hover:shadow-lg transition-all duration-200"
          >
            MAX
          </Button>
        </div>

        <div className="space-y-2">
          <NumberInput max={maxAffordable} min={0} step={100} value={troopCount} onChange={onChange} />
          <div className="flex justify-between items-center text-sm">
            <span className="text-gold/60">Available:</span>
            <span className="text-gold font-semibold">{maxAffordable.toLocaleString()}</span>
          </div>
          {shouldShowCapacityInfo && capacityLimitDisplay !== null && (
            <div className="text-xs text-gold/60">Capacity remaining: {capacityLimitDisplay.toLocaleString()}</div>
          )}
        </div>

        {isAtCapacity && maxCapacity !== null && (
          <div className="bg-danger/10 border border-danger/40 rounded-md px-3 py-2 text-xs text-danger">
            Maximum capacity reached ({maxCapacity.toLocaleString()} troops).
          </div>
        )}
      </div>

      {troopCount > maxAffordable && (
        <div className="bg-gradient-to-r from-danger/15 to-danger/10 border-2 border-danger/40 rounded-xl p-4 mt-4 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-1 rounded-full bg-danger/20">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <span className="text-danger font-bold text-base">Insufficient Resources</span>
          </div>
          <p className="text-sm text-danger/90 ml-8">
            You need <span className="font-bold">{troopCount.toLocaleString()}</span> troops but only have{" "}
            <span className="font-bold">{maxAffordable.toLocaleString()}</span> available
          </p>
        </div>
      )}
    </div>
  );
};
