import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useOwnedMilitaryStructureInfos } from "@/hooks/helpers/use-owned-structure-info";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { Direction } from "@bibliothecadao/types";
import { useMemo, useState } from "react";
import { ArmyTypeToggle } from "./army-type-toggle";
import { DefenseSlotSelection } from "./defense-slot-selection";
import { RealmHexDeployMap } from "./realm-hex-deploy-map";
import { DeployTroops, DeployVerb } from "./deploy-form";
import type { TroopStack } from "./types";
import { useArmyCreation } from "./use-army-creation";

interface UnifiedArmyCreationProps {
  structureId?: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  /** The troop stack an order named; the form opens on that troop at that count, within what can be raised. */
  initialTroops?: TroopStack;
  followSelectedStructure?: boolean;
}

type UnifiedArmyCreationBodyProps = UnifiedArmyCreationProps & {
  /**
   * Whether the form is on screen. A form that is not (the phone's other tab) keeps its draft but draws nothing, its
   * Deploy included, so no hidden choice can be sent.
   */
  shown?: boolean;
};

export const UnifiedArmyCreationBody = ({
  structureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
  initialGuardSlot,
  initialTroops,
  followSelectedStructure,
  shown = true,
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

    return sortedPlayerStructures[0]?.entityId;
  }, [shouldFollowSelection, resolvedSelectedStructureId, resolvedStructureIdProp, sortedPlayerStructures]);

  const form = useArmyCreation({
    structureId: activeStructureId,
    maxDefenseSlots,
    isExplorer,
    direction,
    initialGuardSlot,
    initialTroops,
  });
  if (!shown) return null;

  // Where it goes, then the troops; the one verb sits in the window's foot.
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
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
        {form.armyType && form.deployCenter && (
          <RealmHexDeployMap
            centerCol={form.deployCenter.col}
            centerRow={form.deployCenter.row}
            ring={form.deployRing}
            selectedDirection={form.selectedDirection}
            onSelect={form.handleDirectionSelect}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <DeployTroops form={form} />
        {form.troopSourceLine && <p className="text-hud-label text-hud-muted">{form.troopSourceLine}</p>}
      </div>
      <DeployVerb form={form} />
    </div>
  );
};
