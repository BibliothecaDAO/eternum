import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { ArmyChip } from "@/ui/components/military/army-chip";
import Button from "@/ui/elements/button";
import { Headline } from "@/ui/elements/headline";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { BuildingType, configManager, PlayerStructure, StructureType, TileManager } from "@bibliothecadao/eternum";
import { useArmiesByStructure, useDojo } from "@bibliothecadao/react";
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

  const { entityArmies: structureArmies } = useArmiesByStructure({
    structureEntityId: structure?.structure.entity_id || 0,
  });

  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const troopConfig = configManager.getTroopConfig();

  const [loading, setLoading] = useState<boolean>(false);

  const maxAmountOfArmies = useMemo(() => {
    const maxWithBuildings =
      troopConfig.baseArmyNumberForStructure +
      existingBuildings.filter(
        (building) =>
          building.category === BuildingType[BuildingType.ArcheryRange] ||
          building.category === BuildingType[BuildingType.Barracks] ||
          building.category === BuildingType[BuildingType.Stable],
      ).length *
        troopConfig.armyExtraPerMilitaryBuilding;
    // remove 1 to force to create defensive army first
    const hardMax = troopConfig.maxArmiesPerStructure - 1;
    return Math.min(maxWithBuildings, hardMax);
  }, [existingBuildings]);

  const numberAttackingArmies = useMemo(() => {
    return structureArmies.filter((army) => !army.protectee).length;
  }, [structureArmies]);

  const numberDefensiveArmies = useMemo(() => {
    return structureArmies.filter((army) => army.protectee).length;
  }, [structureArmies]);

  const isRealm = structure.category === StructureType[StructureType.Realm];

  const handleCreateArmy = (is_defensive_army: boolean) => {
    if (!structure.structure.entity_id) throw new Error("Structure's entity id is undefined");
    setLoading(true);
    create_army({
      signer: account,
      army_owner_id: structure.structure.entity_id,
      is_defensive_army,
    }).finally(() => {
      setLoading(false);
    });
  };
  return (
    <div className="military-panel-selector p-4 bg-brown/90 rounded-lg">
      <Headline>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xl font-bold text-gold">{structure.name}</div>
          <HintModalButton section={HintSection.Combat} />
        </div>
      </Headline>

      <div className="grid grid-cols-3 gap-4 p-3 bg-brown/90 rounded-md">
        <div className="text-center">
          <div className="text-sm text-gold">Attacking</div>
          <div className="text-lg font-bold text-gold/90">{numberAttackingArmies}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gold">Defending</div>
          <div className="text-lg font-bold text-gold/90">{numberDefensiveArmies}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gold">Total</div>
          <div className="text-lg font-bold text-gold/90">
            {numberAttackingArmies + numberDefensiveArmies} / {maxAmountOfArmies}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 my-6">
        <div
          onMouseEnter={() => {
            if (!isRealm) {
              setTooltip({
                content: "Can only create attacking armies on realms",
                position: "top",
              });
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            isLoading={loading}
            variant="primary"
            onClick={() => handleCreateArmy(false)}
            disabled={loading || numberAttackingArmies + numberDefensiveArmies >= maxAmountOfArmies || !isRealm}
            className="attack-army-selector px-6 py-2 text-lg"
          >
            Create Army
          </Button>
        </div>

        <div
          onMouseEnter={() => {
            if (!isRealm) {
              setTooltip({
                content: "Can only create defensive armies on realms",
                position: "top",
              });
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            isLoading={loading}
            variant="primary"
            onClick={() => handleCreateArmy(true)}
            disabled={loading || numberAttackingArmies + numberDefensiveArmies >= maxAmountOfArmies || !isRealm}
            className="defense-army-selector px-6 py-2 text-lg"
          >
            Create Defense Army
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Headline>
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold text-gold">Armies</div>
          </div>
        </Headline>

        <div className="space-y-3">
          {structureArmies.map((army) => (
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
          troops={structureArmies.map((army) => ({
            id: army.entityId,
            troops: army.troops,
          }))}
          cooldownSlots={[3]}
        />
      </div>
    </div>
  );
};
