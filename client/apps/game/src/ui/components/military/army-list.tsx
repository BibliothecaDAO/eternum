import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { ArmyChip } from "@/ui/components/military/army-chip";
import { ArmyCreate } from "@/ui/components/military/army-management-card";
import Button from "@/ui/elements/button";
import { Headline } from "@/ui/elements/headline";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import {
  ArmyManager,
  BuildingType,
  configManager,
  PlayerStructure,
  StructureType,
  TileManager,
} from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure, useGuardsByStructure } from "@bibliothecadao/react";
import { useMemo, useState } from "react";
import { StructureDefence } from "./structure-defence";

export const EntityArmyList = ({ structure }: { structure: PlayerStructure }) => {
  const dojo = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
    col: structure.position.x,
    row: structure.position.y,
  });
  const existingBuildings = tileManager.existingBuildings();

  const explorers = useExplorersByStructure({
    structureEntityId: structure?.structure.entity_id || 0,
  });

  const guards = useGuardsByStructure({
    structureEntityId: structure?.structure.entity_id || 0,
  });

  const troopConfig = useMemo(() => configManager.getTroopConfig(), []);

  const [showTroopSelection, setShowTroopSelection] = useState<boolean>(false);

  const maxAmountOfArmies = useMemo(() => {
    const maxWithBuildings =
      structure.structure.base.troop_max_explorer_count +
      existingBuildings.filter(
        (building) =>
          building.category === BuildingType[BuildingType.ArcheryRange] ||
          building.category === BuildingType[BuildingType.Barracks] ||
          building.category === BuildingType[BuildingType.Stable],
      ).length *
        troopConfig.troop_limit_config.troops_per_military_building;
    // remove 1 to force to create defensive army first
    const hardMax = troopConfig.troop_limit_config.explorer_max_party_count - 1;
    return Math.min(maxWithBuildings, hardMax);
  }, [existingBuildings]);

  const numberAttackingArmies = useMemo(() => {
    return explorers.length;
  }, [explorers]);

  const numberDefensiveArmies = useMemo(() => {
    return guards.length;
  }, [guards]);

  const isRealm = structure.category === StructureType.Realm;

  const armyManager = useMemo(() => {
    if (!structure.structure.entity_id) return null;
    return new ArmyManager(dojo.network.provider, dojo.setup.components, structure.structure.entity_id);
  }, [structure.structure.entity_id, dojo.network.provider, dojo.setup.components]);

  return (
    <div className="military-panel-selector p-4 bg-brown/90 rounded-lg">
      <Headline>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xl font-bold text-gold">{structure.name}</div>
          <HintModalButton section={HintSection.Combat} />
        </div>
      </Headline>

      <div className="grid grid-cols-2 gap-4 p-3 bg-brown/90 rounded-md">
        <div className="text-center">
          <div className="text-sm text-gold">Explorers</div>
          <div className="text-lg font-bold text-gold/90">
            {numberAttackingArmies} / {structure.structure.base.troop_max_explorer_count}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gold">Guards</div>
          <div className="text-lg font-bold text-gold/90">
            {numberDefensiveArmies} / {structure.structure.base.troop_max_guard_count}
          </div>
        </div>
      </div>

      <div className="gap-4 my-6 border-2 border-gold/50 rounded-lg p-4">
        <div
          className="flex justify-center items-center p-4 "
          onMouseEnter={() => {
            if (!isRealm) {
              setTooltip({
                content: "Can only create attacking armies on realms",
                position: "top",
              });
            } else if (numberAttackingArmies + numberDefensiveArmies >= maxAmountOfArmies) {
              setTooltip({
                content: "Maximum number of armies reached",
                position: "top",
              });
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            variant="primary"
            disabled={!isRealm || numberAttackingArmies + numberDefensiveArmies >= maxAmountOfArmies}
            className="attack-army-selector px-6 py-2 text-lg"
            onClick={() => setShowTroopSelection(!showTroopSelection)}
          >
            {showTroopSelection ? "Create Attack Army" : "Create Attack Army"}
          </Button>
        </div>

        {showTroopSelection && armyManager && (
          <ArmyCreate
            owner_entity={structure.structure.entity_id || 0}
            army={undefined}
            armyManager={armyManager}
            isExplorer={true}
          />
        )}
      </div>

      <div className="space-y-4">
        <Headline>
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold text-gold">Armies</div>
          </div>
        </Headline>

        <div className="space-y-3">
          {explorers.map((army) => (
            <ArmyChip key={army.entityId} className="w-full" army={army} showButtons />
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Headline>
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold text-gold">Structure Defenses</div>
          </div>
        </Headline>

        <StructureDefence
          maxDefenses={4}
          troops={guards.map((army) => ({
            slot: army.slot,
            troops: army.troops,
          }))}
          cooldownSlots={[3]}
        />
      </div>
    </div>
  );
};
