import { HudNotice, HudTabs } from "@/ui/design-system/kit/hud-elements";

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
      <HudTabs
        tabs={[
          {
            key: "attack",
            label: `Attack ${currentExplorersCount}/${maxExplorers ?? "—"}`,
            title: `Field armies: ${currentExplorersCount} of ${maxExplorers ?? "—"}`,
          },
          {
            key: "defense",
            label: `Defense ${currentGuardsCount ?? "—"}/${maxGuards}`,
            title: `Guard slots filled: ${currentGuardsCount ?? "—"} of ${maxGuards}`,
            disabled: !canInteractWithDefense,
          },
        ]}
        value={armyType ? "attack" : "defense"}
        onChange={(key) => onSelect(key === "attack")}
      />
      {shouldShowLimitWarning && <HudNotice line={limitMessage} />}
    </div>
  );
};
