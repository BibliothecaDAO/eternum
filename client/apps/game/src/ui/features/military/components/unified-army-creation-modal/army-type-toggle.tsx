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
    <div className="rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
      <div className="text-center mb-6">
        <h6 className="text-gold text-lg font-bold mb-1">ARMY TYPE</h6>
        <p className="text-gold/60 text-sm">Choose between attack or defense</p>
      </div>

      <div className="flex gap-3">
        <Button
          variant={armyType ? "gold" : "outline"}
          onClick={() => onSelect(true)}
          size="lg"
          disabled={!canCreateAttackArmy}
          className={clsx(
            "flex-1 py-4 font-bold transition-all duration-300 relative rounded-xl",
            "flex flex-col items-center gap-2",
            armyType ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-105" : "hover:bg-gold/10 hover:scale-102",
            !canCreateAttackArmy && "opacity-50 cursor-not-allowed",
          )}
        >
          <Users className="w-5 h-5" />
          <span>ATTACK</span>
          <div className="absolute -top-3 -right-3 bg-gradient-to-br from-gold/90 to-gold/70 text-brown text-xs px-2 py-1 rounded-full border-2 border-gold shadow-lg font-bold">
            {currentExplorersCount}/{maxExplorers}
          </div>
        </Button>
        <Button
          variant={!armyType ? "gold" : "outline"}
          onClick={() => onSelect(false)}
          size="lg"
          disabled={!canInteractWithDefense}
          className={clsx(
            "flex-1 py-4 font-bold transition-all duration-300 relative rounded-xl",
            "flex flex-col items-center gap-2",
            !armyType ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-105" : "hover:bg-gold/10 hover:scale-102",
            !canInteractWithDefense && "opacity-50 cursor-not-allowed",
          )}
        >
          <Shield className="w-5 h-5" />
          <span>DEFENSE</span>
          <div className="absolute -top-3 -right-3 bg-gradient-to-br from-gold/90 to-gold/70 text-brown text-xs px-2 py-1 rounded-full border-2 border-gold shadow-lg font-bold">
            {currentGuardsCount}/{maxGuards}
          </div>
        </Button>
      </div>

      {shouldShowLimitWarning && (
        <div className="bg-gradient-to-r from-light-danger/15 to-light-danger/10 border-2 border-gold/40 rounded-xl p-4 mt-4 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-1 rounded-full bg-danger/20">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <span className="text-danger font-bold text-base">Army Limit Reached</span>
          </div>
          <p className="text-sm text-danger/90 ml-8">{limitMessage}</p>
        </div>
      )}
    </div>
  );
};
