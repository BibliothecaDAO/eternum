import { ResourcesIds, TroopType } from "@bibliothecadao/eternum";
import { TroopInfo, Troops } from "./combat-container";

// Helper functions
export const getTroopResourceId = (troopType: TroopType): number => {
  const TROOP_RESOURCES = [
    { type: TroopType.Knight, resourceId: ResourcesIds.Knight },
    { type: TroopType.Crossbowman, resourceId: ResourcesIds.Crossbowman },
    { type: TroopType.Paladin, resourceId: ResourcesIds.Paladin },
  ];
  return TROOP_RESOURCES.find((t) => t.type === troopType)?.resourceId || ResourcesIds.Knight;
};

export const formatBiomeBonus = (bonus: number) => {
  const percentage = ((bonus - 1) * 100).toFixed(0);
  if (percentage === "0") return "No bonus";
  return percentage.startsWith("-") ? (
    <span className="text-order-giants">{percentage}%</span>
  ) : (
    <span className="text-order-brilliance">+{percentage}%</span>
  );
};

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

export const getDominantTroopInfo = (troops: Troops): TroopInfo => {
  const { knight_count, crossbowman_count, paladin_count } = troops;

  if (knight_count >= crossbowman_count && knight_count >= paladin_count) {
    return { type: TroopType.Knight, count: knight_count, label: "Knights" };
  }
  if (crossbowman_count >= knight_count && crossbowman_count >= paladin_count) {
    return { type: TroopType.Crossbowman, count: crossbowman_count, label: "Crossbowmen" };
  }
  return { type: TroopType.Paladin, count: paladin_count, label: "Paladins" };
};

export const calculateRemainingTroops = (originalTroops: Troops, troopsLost: number, totalTroops: number) => {
  return {
    knight_count: Math.ceil(Number(originalTroops.knight_count) * (1 - troopsLost / totalTroops)),
    paladin_count: Math.ceil(Number(originalTroops.paladin_count) * (1 - troopsLost / totalTroops)),
    crossbowman_count: Math.ceil(Number(originalTroops.crossbowman_count) * (1 - troopsLost / totalTroops)),
  };
};
