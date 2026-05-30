import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getTierStyle } from "@/ui/utils/tier-styles";
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
  /** Drop outer card chrome so the grid blends with a unified parent card. */
  bare?: boolean;
}

export const TroopSelectionGrid = ({
  options,
  selected,
  isDefenseTroopLocked,
  selectedGuardCategory,
  selectedGuardTier,
  onSelect,
  bare = false,
}: TroopSelectionGridProps) => {
  const lockedMap = useMemo(() => {
    if (!isDefenseTroopLocked || selectedGuardCategory === undefined || selectedGuardTier === undefined) {
      return null;
    }

    return `${selectedGuardCategory}-${selectedGuardTier}`;
  }, [isDefenseTroopLocked, selectedGuardCategory, selectedGuardTier]);

  return (
    <div className={bare ? "p-1" : "rounded-lg bg-brown/5 border border-gold/30 p-2.5 shadow-sm"}>
      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <div key={option.type} className="flex flex-col gap-2">
            {/* Header */}
            <div className="text-center py-1 border-b border-gold/30">
              <span className="text-gold text-xs font-bold uppercase tracking-wider">{option.label}</span>
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
                          getTierStyle(tierOption.tier),
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
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      {/* Tier Badge */}
                      <div
                        className={clsx(
                          "flex items-center justify-center px-1 py-0.5 rounded border text-xs font-bold shadow-sm flex-shrink-0",
                          getTierStyle(tierOption.tier),
                          isSelected && "shadow-md",
                        )}
                      >
                        {tierOption.tier}
                      </div>

                      {/* Resource Icon */}
                      <div className="flex-shrink-0">
                        <ResourceIcon resource={tierOption.resourceTrait} size="sm" withTooltip={false} />
                      </div>

                      {/* Count — min-w-0 + truncate so a large value can never
                          overflow the narrow card. */}
                      <div
                        className={clsx(
                          "min-w-0 flex-1 truncate text-right text-sm font-bold tabular-nums",
                          isSelected ? "text-gold" : "text-gold/90",
                        )}
                      >
                        {tierOption.available.toLocaleString()}
                      </div>
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
