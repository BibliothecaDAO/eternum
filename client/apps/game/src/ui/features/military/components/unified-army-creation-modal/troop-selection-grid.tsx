import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getTierStyle } from "@/ui/utils/tier-styles";
import clsx from "clsx";
import { useMemo } from "react";
import { TroopTier, TroopType } from "@bibliothecadao/types";

import type { SelectedTroopCombo, TroopSelectionOption } from "./types";

interface TroopSelectionGridProps {
  options: TroopSelectionOption[];
  selected: SelectedTroopCombo;
  isDefenseTroopLocked: boolean;
  selectedGuardCategory?: TroopType;
  selectedGuardTier?: TroopTier;
  onSelect: (type: TroopType, tier: TroopTier) => void;
}

export const TroopSelectionGrid = ({
  options,
  selected,
  isDefenseTroopLocked,
  selectedGuardCategory,
  selectedGuardTier,
  onSelect,
}: TroopSelectionGridProps) => {
  const lockedMap = useMemo(() => {
    if (!isDefenseTroopLocked || selectedGuardCategory === undefined || selectedGuardTier === undefined) {
      return null;
    }

    return `${selectedGuardCategory}-${selectedGuardTier}`;
  }, [isDefenseTroopLocked, selectedGuardCategory, selectedGuardTier]);

  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="text-center mb-6">
        <h6 className="text-gold text-lg font-bold mb-1">SELECT TROOP TYPE</h6>
        <p className="text-gold/60 text-sm">Choose your troop type and tier</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {options.map((option) => (
          <div key={option.type} className="space-y-3">
            <div className="text-center">
              <div className="text-gold/90 text-sm font-bold uppercase tracking-wide mb-2 border-b border-gold/30 pb-1">
                {option.label}
              </div>
            </div>
            {option.tiers.map((tierOption) => {
              const isSelected = selected.type === option.type && selected.tier === tierOption.tier;
              const hasResources = tierOption.available > 0;
              const lockedKey = `${option.type}-${tierOption.tier}`;
              const isLockedOption = Boolean(lockedMap && lockedMap !== lockedKey);
              const canSelect = hasResources && !isLockedOption;

              return (
                <div
                  key={`${option.type}-${tierOption.tier}`}
                  className={clsx(
                    "p-3 flex flex-col cursor-pointer transition-all duration-300 rounded-xl border-2 relative group transform",
                    "backdrop-blur-sm",
                    isSelected
                      ? "border-gold bg-gradient-to-br from-gold/25 to-gold/15 ring-2 ring-gold/40 shadow-xl shadow-gold/30 scale-105"
                      : canSelect
                        ? "border-brown/40 bg-gradient-to-br from-brown/15 to-brown/5 hover:border-gold/50 hover:bg-gradient-to-br hover:from-gold/20 hover:to-gold/10 hover:shadow-lg hover:scale-102 hover:-translate-y-0.5"
                        : "border-gray/20 bg-gray/5 opacity-50 cursor-not-allowed",
                    isLockedOption && "pointer-events-none",
                    "hover:z-10 relative",
                  )}
                  onClick={() => canSelect && onSelect(option.type, tierOption.tier)}
                >
                  <div className="absolute -top-2 -right-2 z-10">
                    <div
                      className={clsx(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-lg",
                        "transition-all duration-300 bg-brown",
                        hasResources ? getTierStyle(`T${tierOption.tier}`) : "bg-gray/50  border-gray-400",
                        isSelected && "scale-110 shadow-gold/50",
                      )}
                    >
                      {tierOption.tier}
                    </div>
                  </div>

                  <div
                    className={clsx(
                      "flex items-center justify-center p-3 rounded-lg mb-3 transition-all duration-300",
                      isSelected
                        ? "bg-gold/20 shadow-inner"
                        : hasResources
                          ? "bg-brown/20 group-hover:bg-gold/15"
                          : "bg-gray/10",
                    )}
                  >
                    <ResourceIcon resource={tierOption.resourceTrait} size="md" withTooltip={false} />
                  </div>

                  <div className="space-y-1">
                    <div
                      className={clsx(
                        "text-center text-base font-bold transition-colors duration-300",
                        isSelected ? "text-gold" : hasResources ? "text-gold/90" : "",
                      )}
                    >
                      {hasResources
                        ? tierOption.available > 999
                          ? `${Math.floor(tierOption.available / 1000)}k`
                          : tierOption.available.toLocaleString()
                        : "0"}
                    </div>
                    <div
                      className={clsx(
                        "text-center text-xs font-medium transition-colors duration-300",
                        isSelected ? "text-gold/80" : "text-gold/50",
                      )}
                    >
                      available
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute inset-0 rounded-xl bg-gold/5 animate-pulse pointer-events-none" />
                  )}
                  {isLockedOption && (
                    <div className="absolute inset-0 rounded-xl bg-brown/70 backdrop-blur-sm flex items-center justify-center text-xs font-semibold text-gold/80 uppercase tracking-wide">
                      Locked
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
