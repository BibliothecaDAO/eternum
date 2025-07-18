import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, divideByPrecision, getTroopResourceId } from "@bibliothecadao/eternum";
import { BiomeType, resources, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import { Shield, Sword, Users } from "lucide-react";
import { formatTypeAndBonuses } from "../combat-utils";

interface TroopDisplayProps {
  troops: Troops;
  title: string;
  isAttacker: boolean;
  biome: BiomeType;
  stamina: bigint;
  staminaModifier: number;
  losses?: number;
  showLosses?: boolean;
  remainingTroops?: number;
  showRemaining?: boolean;
  className?: string;
  isCompact?: boolean;
}

export const TroopDisplay = ({
  troops,
  title,
  isAttacker,
  biome,
  stamina,
  staminaModifier,
  losses = 0,
  showLosses = false,
  remainingTroops,
  showRemaining = false,
  className = "",
  isCompact = false,
}: TroopDisplayProps) => {
  const troopCount = divideByPrecision(Number(troops.count));
  const troopResource = resources.find(
    (r) => r.id === getTroopResourceId(troops.category as TroopType, troops.tier as TroopTier),
  );

  if (isCompact) {
    return (
      <div className={`p-3 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gold flex items-center gap-2">
            {isAttacker ? <Sword className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            {title}
          </h4>
          <div className="flex flex-col items-end gap-1 text-xs">
            <div className="flex items-center gap-1 text-gold/70">
              <Users className="w-3 h-3" />
              {troopCount}
            </div>
            {showRemaining && remainingTroops !== undefined && (
              <div
                className={`text-xs font-bold ${
                  remainingTroops > troopCount * 0.8
                    ? "text-green-400"
                    : remainingTroops > troopCount * 0.5
                      ? "text-yellow-400"
                      : remainingTroops > 0
                        ? "text-orange-400"
                        : "text-red-400"
                }`}
              >
                {Math.floor(remainingTroops)} left
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <ResourceIcon withTooltip={false} resource={troopResource?.trait || ""} size="sm" className="w-5 h-5" />
          <span className="text-sm text-gold/90 font-medium">
            {TroopType[troops.category as TroopType]} {troops.tier}
          </span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gold/70">Stamina: {Number(stamina)}</span>
          {showLosses && <span className="text-red-400 font-medium">-{Math.ceil(losses)} casualties</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 sm:p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm ${className}`}
      role="region"
      aria-label={`${title} combat information`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h3 className="text-base sm:text-lg font-semibold text-gold flex items-center gap-2">
          {isAttacker ? (
            <Sword className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          ) : (
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          )}
          <span className="truncate">{title}</span>
        </h3>
        <div className="flex items-center gap-2 text-gold/80 text-sm">
          <Users className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Total Forces</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Troop Information */}
        <div className="p-3 border border-gold/10 rounded bg-brown-900/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <ResourceIcon
              withTooltip={false}
              resource={troopResource?.trait || ""}
              size="md"
              className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h5 className="text-sm sm:text-base font-semibold text-gold truncate">
                {TroopType[troops.category as TroopType]} {troops.tier}
              </h5>
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-gold/70">{troopCount} troops</p>
                {showRemaining && remainingTroops !== undefined && (
                  <div
                    className={`text-xs font-bold ${
                      remainingTroops > troopCount * 0.8
                        ? "text-green-400"
                        : remainingTroops > troopCount * 0.5
                          ? "text-yellow-400"
                          : remainingTroops > 0
                            ? "text-orange-400"
                            : "text-red-400"
                    }`}
                  >
                    {Math.floor(remainingTroops)} after battle
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Combat Bonuses */}
          {formatTypeAndBonuses(
            troops.category as TroopType,
            troops.tier as TroopTier,
            configManager.getBiomeCombatBonus(troops.category as TroopType, biome),
            staminaModifier,
            isAttacker,
            true, // compact mode
          )}
        </div>

        {/* Stamina Information */}
        <div
          className="p-3 border border-gold/10 rounded bg-brown-900/50"
          role="status"
          aria-label="Current stamina level"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gold/80">Current Stamina</span>
            <span className="text-lg font-bold text-gold">{Number(stamina)}</span>
          </div>
        </div>

        {/* Battle Losses */}
        {showLosses && (
          <div
            className="p-3 border border-gold/10 rounded bg-red-900/20"
            role="status"
            aria-label="Expected battle casualties"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-300">Expected Casualties</span>
              <span className="text-lg font-bold text-red-400">-{Math.ceil(losses)}</span>
            </div>
            <div className="mt-1 text-xs text-red-300/80">
              {losses > 0 ? Math.round((losses / troopCount) * 100) : 0}% of forces
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
