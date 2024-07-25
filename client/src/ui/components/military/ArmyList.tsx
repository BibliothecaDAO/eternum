import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useArmiesByEntityOwner } from "@/hooks/helpers/useArmies";
import { PlayerStructure } from "@/hooks/helpers/useEntities";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { QuestName, useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { BuildingType, EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo, useState } from "react";
import { EntityList } from "../list/EntityList";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard } from "./ArmyManagementCard";
	
export const EntityArmyList = ({ structure }: { structure: PlayerStructure }) => {
  const existingBuildings = useUIStore((state) => state.existingBuildings);

  const { entityArmies: structureArmies } = useArmiesByEntityOwner({
    entity_owner_entity_id: structure?.entity_id || 0n,
  });

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const maxAmountOfArmies = useMemo(() => {
    return (
      3 +
      existingBuildings.filter(
        (building) =>
          building.type === BuildingType.ArcheryRange ||
          building.type === BuildingType.Barracks ||
          building.type === BuildingType.Stable,
      ).length *
        EternumGlobalConfig.troop.armyExtraPerMilitaryBuilding
    );
  }, [existingBuildings]);

  const canCreateProtector = useMemo(
    () => !structureArmies.find((army) => army.protectee?.protectee_id),
    [structureArmies],
  );

  const numberAttackingArmies = useMemo(() => {
    return structureArmies.filter((army) => !army.protectee).length;
  }, [structureArmies]);

  const handleCreateArmy = (is_defensive_army: boolean) => {
    if (!structure.entity_id) throw new Error("Structure's entity id is undefined");
    setIsLoading(true);
    create_army({
      signer: account,
      army_owner_id: structure.entity_id,
      is_defensive_army,
    }).finally(() => setIsLoading(false));
  };

  return (
    <>
      <EntityList
        list={structureArmies}
        headerPanel={
          <>
            {" "}
            <div className="px-3 py-2 bg-blueish/20 clip-angled-sm font-bold">
              First you must create an Army then you can enlist troops to it. You can only have one defensive army.
            </div>
            <div
              className={`mt-2 font-bold ${numberAttackingArmies < maxAmountOfArmies ? "text-green" : "text-red"}`}
            >
              {numberAttackingArmies} / {maxAmountOfArmies} armies
            </div>
            <div className="w-full flex justify-between my-4">
              <Button
                isLoading={isLoading}
                variant="primary"
                onClick={() => handleCreateArmy(false)}
                disabled={isLoading || structureArmies.length >= maxAmountOfArmies}
                className={clsx({
                  "animate-pulse": selectedQuest?.name === QuestName.CreateArmy && !selectedQuest.steps[0].completed,
                })}
              >
                Create Army
              </Button>

              <Button
                isLoading={isLoading}
                variant="primary"
                onClick={() => handleCreateArmy(true)}
                disabled={isLoading || !canCreateProtector}
              >
                Create Defense Army
              </Button>
            </div>
          </>
        }
        title="armies"
        panel={({ entity, setSelectedEntity }) => (
          <ArmyItem entity={entity} setSelectedEntity={setSelectedEntity} structure={structure} />
        )}
        questing={
          selectedQuest?.name === QuestName.CreateArmy &&
          selectedQuest.steps[0].completed &&
          !selectedQuest.steps[1].completed
        }
      />
    </>
  );
};

const ArmyItem = ({
  entity,
  setSelectedEntity,
  structure,
}: {
  entity: ArmyInfo | undefined;
  setSelectedEntity: ((entity: ArmyInfo | null) => void) | undefined;
  structure: PlayerStructure;
}) => {
  const dojo = useDojo();

  const { nextBlockTimestamp: currentTimestamp } = useBlockchainStore();

  const battleManager = useMemo(() => new BattleManager(entity?.battle_id || 0n, dojo), [entity?.battle_id, dojo]);

  const updatedArmy = useMemo(() => {
    if (!currentTimestamp) throw new Error("Current timestamp is undefined");
    const updatedBattle = battleManager.getUpdatedBattle(currentTimestamp!);
    const updatedArmy = battleManager.getUpdatedArmy(entity, updatedBattle);
    return updatedArmy;
  }, [currentTimestamp]);

  return (
    <React.Fragment key={entity?.entity_id || 0}>
      <ArmyManagementCard
        owner_entity={structure?.entity_id || 0n}
        army={updatedArmy}
        setSelectedEntity={setSelectedEntity}
      />
      <InventoryResources entityIds={[entity?.entity_id || 0n]} />
    </React.Fragment>
  );
};
