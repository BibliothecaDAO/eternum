import { EntityList } from "../list/EntityList";
import { useEntityArmies, usePositionArmies } from "@/hooks/helpers/useArmies";

import { InventoryResources } from "../resources/InventoryResources";
import { Position } from "@bibliothecadao/eternum";
import { ArmyCard } from "./ArmyCard";
import { useDojo } from "@/hooks/context/DojoContext";
import React, { useState } from "react";
import Button from "@/ui/elements/Button";

export const EntityArmyList = ({ entity_id }: any) => {
  const { entityArmies } = useEntityArmies({ entity_id: entity_id?.entity_id });
  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

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
        list={entityArmies()}
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
                disabled={isLoading}
              >
                Create Defense
              </Button>
            </div>
          </>
        }
        title="armies"
        panel={({ entity }) => (
          <React.Fragment key={entity.entity_id}>
            <ArmyCard owner_entity={entity_id?.entity_id} entity={entity} />
            <InventoryResources entityId={entity.entity_id} />
          </React.Fragment>
        )}
      />
    </>
  );
};

export const PositionArmyList = ({ position }: { position: Position }) => {
  const { positionArmies } = usePositionArmies({ position });

  return (
    <EntityList
      list={positionArmies()}
      title="armies at position"
      panel={({ entity }) => (
        <React.Fragment key={entity.entity_id}>
          <ArmyCard entity={entity} />
          <InventoryResources entityId={entity.entity_id} />
        </React.Fragment>
      )}
    />
  );
};
