import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import Button from "@/ui/design-system/atoms/button";
import clsx from "clsx";

interface ArmyTypeToggleProps {
  armyType: boolean;
  canCreateAttackArmy: boolean;
  canCreateDefenseArmy: boolean;
  canInteractWithDefense: boolean;
  currentExplorersCount: number;
  /** Undefined while the structure is unknown. */
  maxExplorers: number | undefined;
  currentGuardsCount: number | undefined;
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
  const hasDefenseArmies = currentGuardsCount !== undefined && currentGuardsCount > 0;

  // A full cap is where the realm stands, not a mistake: said plainly, with what lifts it.
  const limitMessage = armyType
    ? maxExplorers === undefined
      ? "This structure's army limit is unknown."
      : `All ${maxExplorers} field army slots are in use. Level up the realm or disband an army to raise another.`
    : hasDefenseArmies
      ? `All ${maxGuards} defense slots hold troops. Pick one to reinforce it.`
      : `This structure has no defense slots.`;

  const shouldShowLimitWarning = (armyType && !canCreateAttackArmy) || (!armyType && !canCreateDefenseArmy);

  return (
    <div className="space-y-2">
      {/* Tab Bar */}
      <div className="flex border-b border-gold/20">
        <button
          onClick={() => onSelect(true)}
          title={`Field armies: ${currentExplorersCount} of ${maxExplorers ?? "—"}`}
          className={clsx(
            "flex-1 max-lg:min-h-11 flex items-center justify-center gap-1.5 px-3 py-1.5 transition-all duration-150",
            "border-b-2 -mb-[1px]",
            armyType
              ? "border-gold text-gold bg-gold/5"
              : "border-transparent text-gold/60 hover:text-gold/80 hover:bg-gold/5",
          )}
        >
          <SemanticIcon name="people" className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase">Attack</span>
          <span
            className={clsx(
              "text-xxs px-1 py-0.5 rounded font-bold",
              armyType ? "bg-gold/20 text-gold" : "bg-brown/30 text-gold/70",
            )}
          >
            {currentExplorersCount}/{maxExplorers ?? "—"}
          </span>
        </button>
        <button
          onClick={() => onSelect(false)}
          disabled={!canInteractWithDefense}
          title={`Guard slots filled: ${currentGuardsCount ?? "—"} of ${maxGuards}`}
          className={clsx(
            "flex-1 max-lg:min-h-11 flex items-center justify-center gap-1.5 px-3 py-1.5 transition-all duration-150",
            "border-b-2 -mb-[1px]",
            !armyType
              ? "border-gold text-gold bg-gold/5"
              : "border-transparent text-gold/60 hover:text-gold/80 hover:bg-gold/5",
            !canInteractWithDefense && "opacity-40 cursor-not-allowed",
          )}
        >
          <SemanticIcon name="defend" className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase">Defense</span>
          <span
            className={clsx(
              "text-xxs px-1 py-0.5 rounded font-bold",
              !armyType ? "bg-gold/20 text-gold" : "bg-brown/30 text-gold/70",
            )}
          >
            {currentGuardsCount ?? "—"}/{maxGuards}
          </span>
        </button>
      </div>

      {/* Warning Message */}
      {shouldShowLimitWarning && (
        <div role="status" className="flex items-center gap-1.5 rounded border-l-2 border-gold/40 bg-gold/5 px-2 py-1">
          <SemanticIcon name="info" className="h-3.5 w-3.5 flex-shrink-0 text-gold/70" />
          <span className="text-xs text-gold/80">{limitMessage}</span>
        </div>
      )}
    </div>
  );
};
