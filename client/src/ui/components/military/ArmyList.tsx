import { EntityList } from "../list/EntityList";
import { useEntityArmies, usePositionArmies } from "@/hooks/helpers/useArmies";
import { InventoryResources } from "../resources/InventoryResources";
import { Position } from "@bibliothecadao/eternum";
import { ArmyManagementCard } from "./ArmyManagementCard";
import { useDojo } from "@/hooks/context/DojoContext";
import React, { useMemo, useState } from "react";
import Button from "@/ui/elements/Button";
import { ArmyViewCard } from "./ArmyViewCard";
import { DepositResources } from "../resources/DepositResources";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import { QuestName, useQuestStore } from "@/hooks/store/useQuestStore";
import clsx from "clsx";

export const EntityArmyList = ({ entity_id }: any) => {
  const { entityArmies } = useEntityArmies({ entity_id: entity_id?.entity_id });

  const currentQuest = useQuestStore((state) => state.currentQuest);
  
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
      army_owner_id: entity_id.entity_id,
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
                  "animate-pulse": currentQuest?.name === QuestName.CreateArmy && !currentQuest.steps[0].completed,
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
            <ArmyManagementCard owner_entity={entity_id?.entity_id} entity={entity} />
            <div className="p-2 bg-gold/10 clip-angled my-4">
              <InventoryResources entityId={entity.entity_id} title="balance" />
            </div>

            <DepositResources entityId={entity.entity_id} />
          </React.Fragment>
        )}
        questing={
          currentQuest?.name === QuestName.CreateArmy && currentQuest.steps[0].completed && !currentQuest.steps[1].completed
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
