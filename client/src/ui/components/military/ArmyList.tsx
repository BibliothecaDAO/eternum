import { useDojo } from "@/hooks/context/DojoContext";
import { useEntityArmies, usePositionArmies } from "@/hooks/helpers/useArmies";
import { useResources } from "@/hooks/helpers/useResources";
import { QuestName, useQuestStore } from "@/hooks/store/useQuestStore";
import Button from "@/ui/elements/Button";
import { Position } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo, useState } from "react";
import { EntityList } from "../list/EntityList";
import { DepositResources } from "../resources/DepositResources";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard } from "./ArmyManagementCard";
import { ArmyViewCard } from "./ArmyViewCard";

export const EntityArmyList = ({ structure }: any) => {
  const { entityArmies } = useEntityArmies({ entity_id: structure?.entity_id });

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const canCreateProtector = useMemo(() => !entityArmies.find((army) => army.protectee_id), [entityArmies]);

  const handleCreateArmy = (is_defensive_army: boolean) => {
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
        list={entityArmies}
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
        panel={({ entity }) => (
          <React.Fragment key={entity.entity_id}>
            {/* <StaminaResource entityId={entity.entity_id} className="mb-3" /> */}
            <ArmyManagementCard owner_entity={structure?.entity_id} entity={entity} />
              <InventoryResources entityId={entity.entity_id} />
            <DepositResources entityId={entity.entity_id} />
          </React.Fragment>
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
