import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";

import type { SelectedTroopCombo, TroopSelectionOption } from "./types";

interface TroopSelectionGridProps {
  options: TroopSelectionOption[];
  selected: SelectedTroopCombo;
  isDefenseTroopLocked: boolean;
  selectedGuardCategory?: TroopType;
  selectedGuardTier?: TroopTier;
  onSelect: (type: TroopType, tier: TroopTier) => void;
}

// Match tier badge styling from label-preview.html
const getTierClasses = (tier: TroopTier, isActive = false) => {
  // Convert TroopTier enum ("T1", "T2", "T3") to number
  const tierNumber = typeof tier === "string" ? parseInt(tier.replace("T", ""), 10) : tier;

  switch (tierNumber) {
    case 1:
      return "bg-gradient-to-b from-blue-500/30 to-blue-500/10 border-blue-400/40 text-blue-300";
    case 2:
      return "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 border-emerald-400/40 text-emerald-300";
    case 3:
      return `bg-purple-600 text-[#f6f1e5] border-purple-400 ${isActive ? "animate-pulse" : ""}`;
    default:
      return "bg-gradient-to-b from-gold/30 to-gold/10 border-gold/40 text-gold";
  }
};

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
    <div className="rounded-lg bg-brown/5 border border-gold/30 p-2.5 shadow-sm">
      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <div key={option.type} className="flex flex-col gap-2">
            {/* Header */}
            <div className="text-center py-1 border-b border-gold/30">
              <span className="text-gold text-xs font-bold uppercase tracking-wider">
                {option.label}
              </span>
            </div>

            {/* Tier Cards */}
            <div className="flex flex-col gap-1.5">
              {option.tiers.map((tierOption) => {
                const isSelected = selected.type === option.type && selected.tier === tierOption.tier;
                const hasResources = tierOption.available > 0;
                const lockedKey = `${option.type}-${tierOption.tier}`;
                const isLockedOption = Boolean(lockedMap && lockedMap !== lockedKey);
                const canSelect = hasResources && !isLockedOption;
                const isCollapsed = tierOption.available === 0;

                if (isCollapsed) {
                  // Collapsed Mini Card
                  return (
                    <div
                      key={`${option.type}-${tierOption.tier}`}
                      className={clsx(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all duration-200",
                        "bg-brown/10 border-brown/30 opacity-50",
                        !isLockedOption && "cursor-pointer hover:opacity-70",
                      )}
                      onClick={() => !isLockedOption && onSelect(option.type, tierOption.tier)}
                    >
                      <div
                        className={clsx(
                          "flex items-center justify-center px-1 py-0.5 rounded border text-xxs font-bold",
                          getTierClasses(tierOption.tier),
                        )}
                      >
                        {tierOption.tier}
                      </div>
                      <ResourceIcon resource={tierOption.resourceTrait} size="xs" withTooltip={false} />
                      <span className="text-xs text-gray-600 font-semibold ml-auto">0</span>
                    </div>
                  );
                }

                // Normal Card - Horizontal Layout
                return (
                  <div
                    key={`${option.type}-${tierOption.tier}`}
                    className={clsx(
                      "relative flex flex-col gap-1 p-2 rounded-lg border-2 transition-all duration-200",
                      "cursor-pointer select-none",
                      isSelected
                        ? "border-gold bg-gradient-to-br from-gold/20 to-gold/10 shadow-lg shadow-gold/30 scale-105"
                        : canSelect
                          ? "border-brown/40 bg-gradient-to-br from-brown/10 to-brown/5 hover:border-gold/50 hover:shadow-md hover:scale-102"
                          : "border-brown/20 bg-brown/5 opacity-60 cursor-not-allowed",
                      isLockedOption && "pointer-events-none",
                    )}
                    onClick={() => canSelect && onSelect(option.type, tierOption.tier)}
                  >
                    {/* Top Row: Badge + Icon + Count */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Tier Badge */}
                      <div
                        className={clsx(
                          "flex items-center justify-center px-1 py-0.5 rounded border text-xs font-bold shadow-sm flex-shrink-0",
                          getTierClasses(tierOption.tier, isSelected),
                          isSelected && "shadow-md",
                        )}
                      >
                        {tierOption.tier}
                      </div>

                      {/* Resource Icon */}
                      <div className="flex-shrink-0">
                        <ResourceIcon resource={tierOption.resourceTrait} size="sm" withTooltip={false} />
                      </div>

                      {/* Count */}
                      <div
                        className={clsx(
                          "text-sm font-bold flex-shrink-0",
                          isSelected ? "text-gold" : "text-gold/90",
                        )}
                      >
                        {tierOption.available > 999
                          ? `${Math.floor(tierOption.available / 1000)}k`
                          : tierOption.available.toLocaleString()}
                      </div>
                    </div>

                    {/* Bottom Row: Troop Name */}
                    <div
                      className={clsx(
                        "text-center text-xxs font-bold uppercase tracking-wide",
                        isSelected ? "text-gold" : "text-gold/80",
                      )}
                    >
                      {option.type}
                    </div>

                    {/* Selected Pulse Effect */}
                    {isSelected && (
                      <div className="absolute inset-0 rounded-lg bg-gold/5 animate-pulse pointer-events-none" />
                    )}

                    {/* Locked Overlay */}
                    {isLockedOption && (
                      <div className="absolute inset-0 rounded-lg bg-brown/80 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-xxs font-bold text-gold/80 uppercase tracking-wide">Locked</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
