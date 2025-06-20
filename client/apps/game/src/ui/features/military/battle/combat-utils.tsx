import { TroopTier, TroopType } from "@bibliothecadao/types";
import { Map, Zap } from "lucide-react";

export const getStaminaDisplay = (currentStamina: number, newStamina: number, staminaBonus: number) => {
  return (
    <div className="text-gold/80">
      <div className="text-sm font-medium mb-1">Stamina</div>
      <div className="text-xl font-bold flex items-baseline">
        {currentStamina}
        <span className="mx-2 text-gold/50">→</span>
        {Math.max(0, newStamina)}
        <span className="text-xs ml-2 text-green-400">
          ({staminaBonus > 0 ? "+" : ""}
          {staminaBonus})
        </span>
      </div>
    </div>
  );
};

const formatStaminaModifier = (modifier: number, isAttacker: boolean) => {
  const percentage = ((modifier - 1) * 100).toFixed(0);
  if (percentage === "0") return isAttacker ? "No Bonus" : "No Penalty";
  return percentage.startsWith("-") ? (
    <span className="text-order-giants font-semibold">{percentage}%</span>
  ) : (
    <span className="text-order-brilliance font-semibold">+{percentage}%</span>
  );
};

export const formatBiomeBonus = (bonus: number) => {
  const percentage = ((bonus - 1) * 100).toFixed(0);
  if (percentage === "0") return "No Bonus";
  return percentage.startsWith("-") ? (
    <span className="text-order-giants font-semibold">{percentage}%</span>
  ) : (
    <span className="text-order-brilliance font-semibold">+{percentage}%</span>
  );
};

// Compact version of formatTypeAndBonuses for tight layouts (multi-guard view)
const formatTypeAndBonusesCompact = (
  category: TroopType,
  tier: TroopTier,
  biomeBonus: number,
  staminaModifier: number,
  isAttacker: boolean,
) => {
  return (
    <div className="text-sm text-gold/90">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gold">
          {TroopType[category]} {tier}
        </span>
      </div>
      <div className="flex justify-between items-center text-xs gap-1">
        <div className="flex items-center gap-1 bg-gold/10 px-1.5 py-0.5 rounded">
          <Map className="w-3 h-3 text-gold/80" />
          <span>{formatBiomeBonus(biomeBonus)}</span>
        </div>
        <div className="flex items-center gap-1 bg-gold/10 px-1.5 py-0.5 rounded">
          <Zap className="w-3 h-3 text-gold/80" />
          <span>{formatStaminaModifier(staminaModifier, isAttacker)}</span>
        </div>
      </div>
    </div>
  );
};

export const formatTypeAndBonuses = (
  category: TroopType,
  tier: TroopTier,
  biomeBonus: number,
  staminaModifier: number,
  isAttacker: boolean,
  isCompact = false,
) => {
  // Use compact version for cramped layouts
  if (isCompact) {
    return formatTypeAndBonusesCompact(category, tier, biomeBonus, staminaModifier, isAttacker);
  }

  // Original version for normal layouts
  return (
    <div className="text-sm font-medium text-gold/90 mb-2">
      <h4 className="flex items-center mb-2">
        <span className="text-base font-semibold text-gold">
          {TroopType[category]} {tier}
        </span>
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center p-2.5 bg-gold/10 rounded-md hover:bg-gold/15 transition-colors shadow-sm">
          <div className="w-6 h-6 mr-2 flex items-center justify-center text-gold/80">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gold/70 font-medium uppercase">Terrain Bonus</div>
            <div className="font-bold text-lg">{formatBiomeBonus(biomeBonus)}</div>
          </div>
        </div>

        <div className="flex items-center p-2.5 bg-gold/10 rounded-md hover:bg-gold/15 transition-colors shadow-sm">
          <div className="w-6 h-6 mr-2 flex items-center justify-center text-gold/80">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gold/70 font-medium uppercase">Stamina {isAttacker ? "Bonus" : "Penalty"}</div>
            <div className="font-bold text-lg">{formatStaminaModifier(staminaModifier, isAttacker)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
