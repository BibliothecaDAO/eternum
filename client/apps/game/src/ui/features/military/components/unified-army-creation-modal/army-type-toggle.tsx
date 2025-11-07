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
    <div className="space-y-2">
      {/* Tab Bar */}
      <div className="flex border-b border-gold/20">
        <button
          onClick={() => onSelect(true)}
          disabled={!canCreateAttackArmy}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 transition-all duration-150",
            "border-b-2 -mb-[1px]",
            armyType
              ? "border-gold text-gold bg-gold/5"
              : "border-transparent text-gold/60 hover:text-gold/80 hover:bg-gold/5",
            !canCreateAttackArmy && "opacity-40 cursor-not-allowed",
          )}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase">Attack</span>
          <span className={clsx(
            "text-xxs px-1 py-0.5 rounded font-bold",
            armyType ? "bg-gold/20 text-gold" : "bg-brown/30 text-gold/70"
          )}>
            {currentExplorersCount}/{maxExplorers}
          </span>
        </button>
        <button
          onClick={() => onSelect(false)}
          disabled={!canInteractWithDefense}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 transition-all duration-150",
            "border-b-2 -mb-[1px]",
            !armyType
              ? "border-gold text-gold bg-gold/5"
              : "border-transparent text-gold/60 hover:text-gold/80 hover:bg-gold/5",
            !canInteractWithDefense && "opacity-40 cursor-not-allowed",
          )}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase">Defense</span>
          <span className={clsx(
            "text-xxs px-1 py-0.5 rounded font-bold",
            !armyType ? "bg-gold/20 text-gold" : "bg-brown/30 text-gold/70"
          )}>
            {currentGuardsCount}/{maxGuards}
          </span>
        </button>
      </div>

      {/* Warning Message */}
      {shouldShowLimitWarning && (
        <div className="bg-danger/10 border-l-2 border-danger rounded px-2 py-1 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
          <span className="text-xxs text-danger font-semibold">{limitMessage}</span>
        </div>
      )}
    </div>
  );
};
