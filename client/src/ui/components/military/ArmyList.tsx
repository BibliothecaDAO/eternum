import { EntityList } from "../list/EntityList";
import { useEntityArmies, usePositionArmies } from "@/hooks/helpers/useArmies";
import { InventoryResources } from "../resources/InventoryResources";
import { Position } from "@bibliothecadao/eternum";
import { ArmyManagementCard } from "./ArmyManagementCard";
import { useDojo } from "@/hooks/context/DojoContext";
import React, { useMemo, useState } from "react";
import Button from "@/ui/elements/Button";
import { ArmyViewCard } from "./ArmyViewCard";

export const EntityArmyList = ({ entity_id }: any) => {
  const { entityArmies } = useEntityArmies({ entity_id: entity_id?.entity_id });
  const armyList = entityArmies();
  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const canCreateProtector = useMemo(() => !armyList.find((army) => army.protectee_id), [armyList]);

  const handleCreateArmy = (army_is_protector: boolean) => {
    setIsLoading(true);
    create_army({
      signer: account,
      army_owner_id: entity_id.entity_id,
      army_is_protector,
    }).finally(() => setIsLoading(false));
  };

  return (
    <>
      <EntityList
        list={armyList}
        headerPanel={
          <>
            {" "}
            <div className="p-2 ">
              <p>
                First you must create an Army then you can enlist troops into it. You can only have one defensive army.
              </p>
            </div>
            <div className=" w-full flex">
              <Button
                isLoading={isLoading}
                variant="primary"
                onClick={() => handleCreateArmy(false)}
                disabled={isLoading}
              >
                Create Army
              </Button>

              <Button
                isLoading={isLoading}
                variant="primary"
                onClick={() => handleCreateArmy(true)}
                disabled={isLoading || !canCreateProtector}
              >
                Create Defense
              </Button>
            </div>
          </>
        }
        title="armies"
        panel={({ entity }) => (
          <React.Fragment key={entity.entity_id}>
            <ArmyManagementCard owner_entity={entity_id?.entity_id} entity={entity} />
            <InventoryResources entityId={entity.entity_id} />
          </React.Fragment>
        )}
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
