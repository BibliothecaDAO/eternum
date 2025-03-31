import { TroopTier, TroopType } from "@bibliothecadao/eternum";
import { Map, Zap } from "lucide-react";

export const getStaminaDisplay = (
  currentStamina: number,
  newStamina: number,
  isWinner: boolean,
  staminaBonus: number,
) => {
  return (
    <div className="text-gold/80">
      <div className="text-sm font-medium mb-1">Stamina</div>
      <div className="text-xl font-bold flex items-baseline">
        {Math.max(0, newStamina)}
        <span className="text-xs ml-2 text-gold/50">/ {currentStamina}</span>
        {isWinner && <span className="text-xs ml-2 text-green-400">(+{staminaBonus})</span>}
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

export const formatTypeAndBonuses = (
  category: TroopType,
  tier: TroopTier,
  biomeBonus: number,
  staminaModifier: number,
  isAttacker: boolean,
) => {
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
