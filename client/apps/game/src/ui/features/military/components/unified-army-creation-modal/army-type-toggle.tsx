import Button from "@/ui/design-system/atoms/button";
import clsx from "clsx";
import { AlertTriangle, Shield, Users } from "lucide-react";

interface ArmyTypeToggleProps {
  armyType: boolean;
  canCreateAttackArmy: boolean;
  canCreateDefenseArmy: boolean;
  canInteractWithDefense: boolean;
  currentExplorersCount: number;
  maxExplorers: number;
  currentGuardsCount: number;
  maxGuards: number;
  onSelect: (isAttack: boolean) => void;
}

export const ArmyTypeToggle = ({
  armyType,
  canCreateAttackArmy,
  canCreateDefenseArmy,
  canInteractWithDefense,
  currentExplorersCount,
  maxExplorers,
  currentGuardsCount,
  maxGuards,
  onSelect,
}: ArmyTypeToggleProps) => {
  const hasDefenseArmies = currentGuardsCount > 0;

  const limitMessage = armyType
    ? `Maximum attack armies (${maxExplorers}) created. Delete an existing army to create a new one.`
    : hasDefenseArmies
      ? `All defense slots (${maxGuards}) are occupied. Reinforce an existing slot or delete one to free space.`
      : `This structure does not have available defense slots.`;

  const shouldShowLimitWarning = (armyType && !canCreateAttackArmy) || (!armyType && !canCreateDefenseArmy);

  return (
    <div className="rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20 p-1.5">
      <div className="flex gap-1.5">
        <Button
          variant={armyType ? "gold" : "outline"}
          onClick={() => onSelect(true)}
          disabled={!canCreateAttackArmy}
          className={clsx(
            "flex-1 py-2 font-bold transition-all duration-200 rounded-lg",
            "flex items-center justify-center gap-2",
            armyType ? "ring-2 ring-gold shadow-xl shadow-gold/40 scale-105" : "hover:bg-gold/10 hover:scale-102",
            !canCreateAttackArmy && "opacity-50 cursor-not-allowed",
          )}
        >
          <Users className="w-4 h-4" />
          <span className="text-xs">ATTACK</span>
          <span className="text-xxs bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-extrabold ml-1">
            {currentExplorersCount}/{maxExplorers}
          </span>
        </Button>
        <Button
          variant={!armyType ? "gold" : "outline"}
          onClick={() => onSelect(false)}
          disabled={!canInteractWithDefense}
          className={clsx(
            "flex-1 py-2 font-bold transition-all duration-200 rounded-lg",
            "flex items-center justify-center gap-2",
            !armyType ? "ring-2 ring-gold shadow-xl shadow-gold/40 scale-105" : "hover:bg-gold/10 hover:scale-102",
            !canInteractWithDefense && "opacity-50 cursor-not-allowed",
          )}
        >
          <Shield className="w-4 h-4" />
          <span className="text-xs">DEFENSE</span>
          <span className="text-xxs bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-extrabold ml-1">
            {currentGuardsCount}/{maxGuards}
          </span>
        </Button>
      </div>

      {shouldShowLimitWarning && (
        <div className="bg-danger/10 border-l-2 border-danger rounded px-2 py-1.5 mt-1.5 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
          <span className="text-xxs text-danger font-semibold">{limitMessage}</span>
        </div>
      )}
    </div>
  );
};
