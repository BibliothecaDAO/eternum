import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, divideByPrecision, getTroopResourceId } from "@bibliothecadao/eternum";
import { BiomeType, resources, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import { AlertCircle, Shield, ShieldOff, Sparkles, Sword, Timer, Users } from "lucide-react";
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
  relicDamageBonusPercent?: number;
  relicDamageBonusSource?: string;
  relicDamageBonusAbsolute?: number;
  relicDamageReductionPercent?: number;
  relicDamageReductionSource?: string;
  relicDamageReductionAbsolute?: number;
  relicStaminaPercent?: number;
  relicStaminaSource?: string;
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
  relicDamageBonusPercent = 0,
  relicDamageBonusSource,
  relicDamageBonusAbsolute = 0,
  relicDamageReductionPercent = 0,
  relicDamageReductionSource,
  relicDamageReductionAbsolute = 0,
  relicStaminaPercent = 0,
  relicStaminaSource,
}: TroopDisplayProps) => {
  const troopCount = divideByPrecision(Number(troops.count));
  const troopResource = resources.find(
    (r) => r.id === getTroopResourceId(troops.category as TroopType, troops.tier as TroopTier),
  );

  // Check if on cooldown
  const currentTime = Math.floor(Date.now() / 1000);
  const isOnCooldown = troops.battle_cooldown_end > currentTime;

  const formatTroopDelta = (value: number) => {
    if (value <= 0) return "0";
    if (value >= 10) return Math.round(value).toLocaleString();
    if (value >= 1) return value.toFixed(1);
    return value.toFixed(2);
  };

  const renderRelicBonusSection = (isCompactView: boolean) => {
    if (
      relicDamageBonusPercent <= 0 &&
      relicDamageReductionPercent <= 0 &&
      relicStaminaPercent <= 0 &&
      relicDamageBonusAbsolute <= 0 &&
      relicDamageReductionAbsolute <= 0
    ) {
      return null;
    }

    const containerClass = isCompactView
      ? "mt-2 border border-relic-activated/30 bg-relic-activated/10 rounded-md p-2"
      : "mt-4 border border-relic-activated/30 bg-relic-activated/5 rounded-lg p-3";

    const headingClass = isCompactView
      ? "flex items-center gap-1 text-[10px] text-gold/70 uppercase font-semibold mb-1"
      : "flex items-center gap-2 text-xs text-gold/70 uppercase font-semibold mb-2";

    const itemsWrapperClass = isCompactView ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2";

    type RelicBonusItem = {
      key: string;
      label: string;
      value: string;
      valueClass: string;
      chipClass: string;
      source: string | undefined;
      detail?: string;
    };

    const rawItems: Array<RelicBonusItem | null> = [
      relicDamageBonusPercent > 0 || relicDamageBonusAbsolute > 0
        ? {
            key: "damage-output",
            label: "Damage Output",
            value: `+${relicDamageBonusPercent}%`,
            source: relicDamageBonusSource,
            valueClass: "text-order-brilliance",
            chipClass: "bg-gold/10 border border-gold/20",
            detail:
              relicDamageBonusAbsolute > 0
                ? `(+${formatTroopDelta(relicDamageBonusAbsolute)} troops)`
                : undefined,
          }
        : null,
      relicDamageReductionPercent > 0 || relicDamageReductionAbsolute > 0
        ? {
            key: "damage-taken",
            label: "Damage Taken",
            value: `-${relicDamageReductionPercent}%`,
            source: relicDamageReductionSource,
            valueClass: "text-order-giants",
            chipClass: "bg-brown-900/70 border border-gold/20",
            detail:
              relicDamageReductionAbsolute > 0
                ? `(-${formatTroopDelta(relicDamageReductionAbsolute)} troops taken)`
                : undefined,
          }
        : null,
      relicStaminaPercent > 0
        ? {
            key: "stamina-regen",
            label: "Stamina Regen",
            value: `+${relicStaminaPercent}%`,
            source: relicStaminaSource,
            valueClass: "text-order-brilliance",
            chipClass: "bg-gold/10 border border-gold/20",
          }
        : null,
    ];

    const items = rawItems.filter((item): item is RelicBonusItem => item !== null);

    if (items.length === 0) return null;

    return (
      <div className={containerClass}>
        <div className={headingClass}>
          <Sparkles className={`${isCompactView ? "w-3 h-3" : "w-4 h-4"} text-relic2`} />
          Relic Bonuses Applied
        </div>
        <div className={itemsWrapperClass}>
          {items.map((item) => (
            <div
              key={item.key}
              className={`${item.chipClass} ${isCompactView ? "px-1.5 py-1 rounded" : "px-2.5 py-2 rounded-md min-w-[130px]"}`}
            >
              <div className={`${isCompactView ? "text-[10px]" : "text-xs"} text-gold/80 font-medium`}>{item.label}</div>
              <div className={`${isCompactView ? "text-xs" : "text-base"} font-bold ${item.valueClass}`}>
                {item.value}
              </div>
              {item.detail && (
                <div className={`${isCompactView ? "text-[10px]" : "text-xxs"} text-gold/60 mt-0.5`}>{item.detail}</div>
              )}
              {item.source && (
                <div className={`${isCompactView ? "text-[10px]" : "text-xxs"} text-gold/60 mt-0.5`}>{item.source}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

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
                    ? "text-progress-bar-good"
                    : remainingTroops > troopCount * 0.5
                      ? "text-progress-bar-medium"
                      : remainingTroops > 0
                        ? "text-progress-bar-danger"
                        : "text-progress-bar-danger"
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

        {isOnCooldown && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
            <Timer className="w-3 h-3 animate-pulse" />
            <span>Cooldown Active</span>
          </div>
        )}

        {renderRelicBonusSection(true)}
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
              <h5 className="text-sm sm:text-base font-semibold text-gold truncate flex items-center gap-2">
                {TroopType[troops.category as TroopType]}{" "}
                <span className="text-gold/70 font-normal">Tier {troops.tier}</span>
              </h5>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs sm:text-sm text-gold/70 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-gold/60 mr-1" />
                  {troopCount} <span className="hidden sm:inline">troops</span>
                </p>
                {showRemaining && remainingTroops !== undefined && (
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        remainingTroops > troopCount * 0.8
                          ? "bg-progress-bar-good"
                          : remainingTroops > troopCount * 0.5
                            ? "bg-progress-bar-medium"
                            : remainingTroops > 0
                              ? "bg-progress-bar-danger"
                              : "bg-progress-bar-danger"
                      }`}
                    />
                    <span
                      className={`text-xs font-bold ${
                        remainingTroops > troopCount * 0.8
                          ? "text-progress-bar-good"
                          : remainingTroops > troopCount * 0.5
                            ? "text-progress-bar-medium"
                            : remainingTroops > 0
                              ? "text-progress-bar-danger"
                              : "text-progress-bar-danger"
                      }`}
                    >
                      {Math.max(0, Math.floor(remainingTroops))} <span className="hidden sm:inline">after battle</span>
                    </span>
                  </div>
                )}
              </div>
              {showRemaining && remainingTroops !== undefined && (
                <div className="mt-1 w-full h-2 bg-gold/10 rounded overflow-hidden">
                  <div
                    className={`
                      h-full rounded transition-all duration-500
                      ${
                        remainingTroops > troopCount * 0.8
                          ? "bg-progress-bar-good"
                          : remainingTroops > troopCount * 0.5
                            ? "bg-progress-bar-medium"
                            : remainingTroops > 0
                              ? "bg-progress-bar-danger"
                              : "bg-progress-bar-danger"
                      }
                    `}
                    style={{
                      width: `${Math.max(0, Math.min(100, (remainingTroops / troopCount) * 100))}%`,
                    }}
                  />
                </div>
              )}
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

          {renderRelicBonusSection(false)}
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

        {/* Cooldown Status */}
        {isOnCooldown && (
          <div className="p-3 border border-red-500/30 rounded bg-red-900/20" role="alert" aria-live="polite">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-sm font-medium text-red-400">Battle Cooldown Active</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-yellow-400">
                <AlertCircle className="w-3 h-3" />
                <span>{isAttacker ? "Cannot initiate attacks" : "Cannot be ordered to attack"}</span>
              </div>
              {!isAttacker && (
                <div className="flex items-center gap-1 text-xs text-orange-400">
                  <ShieldOff className="w-3 h-3" />
                  <span>-15% damage modifier if attacked</span>
                </div>
              )}
            </div>
          </div>
        )}

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
