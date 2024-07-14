import { useDojo } from "@/hooks/context/DojoContext";
import { getBattleByPosition } from "@/hooks/helpers/battles/useBattles";
import { useArmiesByEntityOwner, usePositionArmies } from "@/hooks/helpers/useArmies";
import { PlayerStructures } from "@/hooks/helpers/useEntities";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import Button from "@/ui/elements/Button";
import { Position } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo, useState } from "react";
import { EntityList } from "../list/EntityList";
import { DepositResources } from "../resources/DepositResources";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard } from "./ArmyManagementCard";
import { ArmyViewCard } from "./ArmyViewCard";
import { QuestName } from "@/hooks/helpers/useQuests";

export const EntityArmyList = ({ structure }: { structure: PlayerStructures }) => {
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

  const getBattle = getBattleByPosition();
  const [isLoading, setIsLoading] = useState(false);

  const canCreateProtector = useMemo(
    () => !structureArmies.find((army) => army.protectee?.protectee_id),
    [structureArmies],
  );
  console.log(structureArmies);
  const handleCreateArmy = (is_defensive_army: boolean) => {
    if (!structure.entity_id) throw new Error("Structure's entity id is undefined");
    setIsLoading(true);
    create_army({
      signer: account,
      army_owner_id: structure.entity_id,
      is_defensive_army,
    }).finally(() => setIsLoading(false));
  };
  console.log("11");
  return (
    <>
      <EntityList
        list={structureArmies}
        headerPanel={
          <>
            {" "}
            <p className="px-3 py-2 bg-blueish/20 clip-angled-sm font-bold">
              First you must create an Army then you can enlist troops to it. You can only have one defensive army.
            </p>
            <div className="w-full flex justify-between my-4">
              <Button
                isLoading={isLoading}
                variant="primary"
                onClick={() => handleCreateArmy(false)}
                disabled={isLoading}
                className={clsx({
                  "animate-pulse": selectedQuest?.name === QuestName.CreateArmy && !entityArmies.length,
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
        panel={({ entity }) => (
          <React.Fragment key={entity.entity_id}>
            <ArmyManagementCard owner_entity={structure?.entity_id || 0n} army={entity} />
            <InventoryResources entityId={entity.entity_id} />
            <DepositResources
              entityId={entity.entity_id}
              battleInProgress={getBattle({ x: entity.position.x, y: entity.position.y }) !== undefined}
            />
          </React.Fragment>
        )}
        questing={selectedQuest?.name === QuestName.CreateArmy}
      />
    </>
  );
};

export const PositionArmyList = ({ position }: { position: Position }) => {
  const { allArmies, userArmies } = usePositionArmies({ position });

  return (
    <div>
      <h4 className="uppercase">Your Armies</h4>
      <div className="grid grid-cols-3">
        {userArmies.map((entity, index) => (
          <ArmyViewCard key={index} army={entity} />
        ))}
      </div>
      <h4 className="uppercase">All Armies</h4>
      <div className="grid grid-cols-3">
        {allArmies.map((entity, index) => (
          <ArmyViewCard key={index} army={entity} />
        ))}
      </div>
    </div>
  );
};
