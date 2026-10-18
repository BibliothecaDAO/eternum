import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";

import type { SelectedTroopCombo, TroopSelectionOption } from "./types";
import { TierChip } from "../../utils/tier-chip";

interface TroopSelectionGridProps {
  options: TroopSelectionOption[];
  selected: SelectedTroopCombo;
  isDefenseTroopLocked: boolean;
  selectedGuardCategory?: TroopType;
  selectedGuardTier?: TroopTier;
  onSelect: (type: TroopType, tier: TroopTier) => void;
  /** Drop outer card chrome so the grid blends with a unified parent card. */
  bare?: boolean;
  compact?: boolean;
}

/** The options' tiers row by row: the first tier of every kind, then the second, so each kind keeps a column. */
const tierRows = (options: TroopSelectionOption[]) =>
  Array.from({ length: Math.max(0, ...options.map((option) => option.tiers.length)) }, (_, index) =>
    options.flatMap((option) => (option.tiers[index] ? [{ option, tier: option.tiers[index] }] : [])),
  );

export const TroopSelectionGrid = ({
  options,
  selected,
  isDefenseTroopLocked,
  selectedGuardCategory,
  selectedGuardTier,
  onSelect,
  bare = false,
  compact = false,
}: TroopSelectionGridProps) => {
  const lockedMap = useMemo(() => {
    if (!isDefenseTroopLocked || selectedGuardCategory === undefined || selectedGuardTier === undefined) {
      return null;
    }

    return `${selectedGuardCategory}-${selectedGuardTier}`;
  }, [isDefenseTroopLocked, selectedGuardCategory, selectedGuardTier]);

  if (compact) {
    return (
      // A column per kind under its name, as the Military window lays them out, its tiers going down.
      <div className="grid grid-cols-3 gap-2 p-1" role="group" aria-label="Available troops">
        {options.map((option) => (
          <span key={option.type} className="text-center text-hud-label text-hud-accent">
            {option.label}
          </span>
        ))}
        {tierRows(options).flatMap((row) =>
          row.map(({ option, tier }) => {
            const key = `${option.type}-${tier.tier}`;
            const isSelected = selected.type === option.type && selected.tier === tier.tier;
            const reason =
              lockedMap && lockedMap !== key
                ? "This guard slot requires its existing troop type and tier."
                : tier.available <= 0
                  ? "No troops in stock."
                  : null;
            return (
              <button
                key={key}
                type="button"
                aria-label={`${option.label} ${tier.tier}: ${tier.available.toLocaleString()} available`}
                aria-pressed={isSelected}
                disabled={Boolean(reason)}
                title={reason ?? `${option.label} ${tier.tier}`}
                className={clsx(
                  "relative flex min-w-0 flex-col items-center rounded border px-1 pt-3 pb-1 text-hud-label tabular-nums disabled:grayscale disabled:opacity-40",
                  isSelected ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line",
                )}
                onClick={() => onSelect(option.type, tier.tier)}
              >
                <span className="absolute top-0.5 right-1 text-hud-label">{tier.tier}</span>
                <ResourceIcon resource={tier.resourceId} size="lg" className="!h-10 !w-10" withTooltip={false} />
                <span className="max-w-full truncate rounded bg-hud-well px-1 text-hud-label">
                  {tier.available.toLocaleString()}
                </span>
              </button>
            );
          }),
        )}
      </div>
    );
  }

  return (
    <div className={bare ? "p-1" : "rounded-lg bg-hud-well border border-hud-line p-2.5 shadow-sm"}>
      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <div key={option.type} className="flex flex-col gap-2">
            {/* Header */}
            <div className="text-center py-1 border-b border-hud-line">
              <span className="text-hud-accent text-hud-label uppercase tracking-wider">{option.label}</span>
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
                        "bg-hud-well border-hud-divider opacity-50",
                        !isLockedOption && "cursor-pointer hover:opacity-70",
                      )}
                      onClick={() => !isLockedOption && onSelect(option.type, tierOption.tier)}
                    >
                      <TierChip tier={tierOption.tier} />
                      <ResourceIcon resource={tierOption.resourceId} size="xs" withTooltip={false} />
                      <span className="text-hud-label text-hud-cue ml-auto">0</span>
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
                        ? "border-hud-line-strong bg-hud-chosen"
                        : canSelect
                          ? "border-hud-divider hover:border-hud-line-strong hover:bg-hud-hover"
                          : "border-hud-divider bg-hud-well opacity-60 cursor-not-allowed",
                      isLockedOption && "pointer-events-none",
                    )}
                    onClick={() => canSelect && onSelect(option.type, tierOption.tier)}
                  >
                    {/* Top Row: Badge + Icon + Count */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      {/* Tier Badge */}
                      <span className="flex-shrink-0">
                        <TierChip tier={tierOption.tier} />
                      </span>

                      {/* Resource Icon */}
                      <div className="flex-shrink-0">
                        <ResourceIcon resource={tierOption.resourceId} size="sm" withTooltip={false} />
                      </div>

                      {/* Count — min-w-0 + truncate so a large value can never
                          overflow the narrow card. */}
                      <div
                        className={clsx(
                          "min-w-0 flex-1 truncate text-right text-hud-strong tabular-nums",
                          "text-hud-ink",
                        )}
                      >
                        {tierOption.available.toLocaleString()}
                      </div>
                    </div>

                    {/* Selected Pulse Effect */}
                    {isSelected && (
                      <div className="absolute inset-0 rounded-lg bg-hud-hover animate-pulse pointer-events-none" />
                    )}

                    {/* Locked Overlay */}
                    {isLockedOption && (
                      <div className="absolute inset-0 rounded-lg bg-hud-well backdrop-blur-sm flex items-center justify-center">
                        <span className="text-hud-label text-hud-accent uppercase tracking-wide">Locked</span>
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
