import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useOwnedMilitaryStructureInfos } from "@/hooks/helpers/use-owned-structure-info";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { Direction } from "@bibliothecadao/types";
import { useMemo, useState } from "react";
import { ActionFooter } from "./action-footer";
import { ArmyTypeToggle } from "./army-type-toggle";
import { DefenseSlotSelection } from "./defense-slot-selection";
import { RealmHexDeployMap } from "./realm-hex-deploy-map";
import { TroopCountSelector } from "./troop-count-selector";
import { TroopSelectionGrid } from "./troop-selection-grid";
import { useArmyCreation } from "./use-army-creation";

interface UnifiedArmyCreationProps {
  structureId?: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  followSelectedStructure?: boolean;
}

type UnifiedArmyCreationBodyProps = UnifiedArmyCreationProps & {
  /**
   * Kept for call-site compatibility. The legacy popup chrome has been removed;
   * the parent Military modal provides the window shell.
   */
  embedded?: boolean;
};

export const UnifiedArmyCreationBody = ({
  structureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
  initialGuardSlot,
  followSelectedStructure,
  embedded = true,
}: UnifiedArmyCreationBodyProps) => {
  const mode = useGameModeConfig();
  const playerStructures = useOwnedMilitaryStructureInfos();
  const selectedStructureId = useUIStore((state) => state.structureEntityId);
  const sortedPlayerStructures = useMemo(
    () =>
      playerStructures.toSorted((a, b) => {
        const nameA = mode.structure.getName(a.structure).name;
        const nameB = mode.structure.getName(b.structure).name;
        return nameA.localeCompare(nameB);
      }),
    [playerStructures, mode],
  );

  const resolveNumericId = (value: unknown): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const resolvedSelectedStructureId = resolveNumericId(selectedStructureId);
  const resolvedStructureIdProp = resolveNumericId(structureId);
  const [shouldFollowSelection] = useState(() => {
    if (followSelectedStructure !== undefined) {
      return followSelectedStructure;
    }

    if (
      resolvedStructureIdProp === null ||
      resolvedSelectedStructureId === null ||
      resolvedStructureIdProp <= UNDEFINED_STRUCTURE_ENTITY_ID ||
      resolvedSelectedStructureId <= UNDEFINED_STRUCTURE_ENTITY_ID
    ) {
      return false;
    }

    return resolvedStructureIdProp === resolvedSelectedStructureId;
  });

  const activeStructureId = useMemo(() => {
    if (
      shouldFollowSelection &&
      resolvedSelectedStructureId &&
      resolvedSelectedStructureId > UNDEFINED_STRUCTURE_ENTITY_ID
    ) {
      return resolvedSelectedStructureId;
    }

    if (resolvedStructureIdProp && resolvedStructureIdProp > UNDEFINED_STRUCTURE_ENTITY_ID) {
      return resolvedStructureIdProp;
    }

    if (resolvedSelectedStructureId && resolvedSelectedStructureId > UNDEFINED_STRUCTURE_ENTITY_ID) {
      return resolvedSelectedStructureId;
    }

    return sortedPlayerStructures[0]?.entityId ?? 0;
  }, [shouldFollowSelection, resolvedSelectedStructureId, resolvedStructureIdProp, sortedPlayerStructures]);

  const form = useArmyCreation({
    structureId: activeStructureId,
    maxDefenseSlots,
    isExplorer,
    direction,
    initialGuardSlot,
  });
  const leftColumnClass = "flex flex-1 min-w-0 flex-col";
  const rightColumnClass = "flex flex-1 min-w-0 flex-col";

  return (
    <div className="p-3">
      <div className="flex items-stretch gap-3">
        <div className={leftColumnClass}>
          <div className="flex flex-1 flex-col rounded-xl border border-gold/25 bg-black/25 p-2 gap-2">
            <TroopSelectionGrid
              options={form.troopOptions}
              selected={form.selectedTroopCombo}
              isDefenseTroopLocked={form.isDefenseTroopLocked}
              selectedGuardCategory={form.selectedGuardCategory}
              selectedGuardTier={form.selectedGuardTier}
              onSelect={form.handleTroopSelect}
              bare
            />
            <div className="border-t border-gold/15" />
            <TroopCountSelector
              troopCount={form.troopCount}
              maxAffordable={form.maxAffordable}
              onChange={form.handleTroopCountChange}
              capacityRemaining={form.capacityRemainingForSelector}
              troopMaxSize={form.troopCapacityLimit ?? undefined}
              embedded
            />
            {form.troopCapacityLimit !== null && form.troopCapacityLimit !== undefined && (
              <>
                <div className="border-t border-gold/15" />
                <div className="flex items-center justify-between px-1 py-0.5 text-[11px]">
                  <span className="uppercase tracking-wider text-gold/55">Max troops</span>
                  <span className="font-semibold tabular-nums text-gold">
                    {form.troopCapacityLimit.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={rightColumnClass}>
          <div className="flex flex-1 flex-col rounded-xl border border-gold/25 bg-black/25 p-2 gap-2">
            <ArmyTypeToggle
              armyType={form.armyType}
              canCreateAttackArmy={form.canCreateAttackArmy}
              canCreateDefenseArmy={form.canCreateDefenseArmy}
              canInteractWithDefense={form.canInteractWithDefense}
              currentExplorersCount={form.currentExplorersCount}
              maxExplorers={form.maxExplorers}
              currentGuardsCount={form.currentGuardsCount}
              maxGuards={form.resolvedMaxDefenseSlots}
              onSelect={form.handleArmyTypeSelect}
            />
            <div className="border-t border-gold/15" />
            <div className="flex-1 min-h-[140px] flex flex-col">
              {!form.armyType && (
                <DefenseSlotSelection
                  guardSlot={form.guardSlot}
                  maxDefenseSlots={form.resolvedMaxDefenseSlots}
                  guardsBySlot={form.guardsBySlot}
                  availableSlots={form.availableGuardSlots}
                  selectedTroopCombo={form.selectedTroopCombo}
                  canCreateDefenseArmy={form.canCreateDefenseArmy}
                  defenseSlotInfoMessage={form.defenseSlotInfoMessage}
                  defenseSlotErrorMessage={form.defenseSlotErrorMessage}
                  onSelect={form.handleGuardSlotSelect}
                />
              )}
              {form.armyType && form.structureCoordX !== undefined && form.structureCoordY !== undefined && (
                <RealmHexDeployMap
                  centerCol={Number(form.structureCoordX)}
                  centerRow={Number(form.structureCoordY)}
                  availableDirections={form.freeDirections}
                  selectedDirection={form.selectedDirection}
                  isLoading={false}
                  onSelect={form.handleDirectionSelect}
                />
              )}
            </div>
          </div>
          <div className="mt-2">
            <ActionFooter
              armyType={form.armyType}
              label={form.actionLabel}
              isLoading={form.isLoading}
              isDisabled={form.isActionDisabled}
              onSubmit={form.handleCreate}
              embedded
            />
          </div>
        </div>
      </div>
    </div>
  );
};
