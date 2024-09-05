import { useDojo } from "@/hooks/context/DojoContext";
import { getResourcesUtils, useOwnedEntitiesOnPosition } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { EntityState, ID, determineEntityState } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useState } from "react";

type DepositResourcesProps = {
  entityId: ID;
  battleInProgress?: boolean;
  armyInBattle: boolean;
};

export const DepositResources = ({ entityId, battleInProgress, armyInBattle }: DepositResourcesProps) => {
  const { account, setup } = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  const { getResourcesFromBalance } = getResourcesUtils();

  const inventoryResources = getResourcesFromBalance(entityId);

  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;
  const { getOwnedEntityOnPosition } = useOwnedEntitiesOnPosition();

  const arrivalTime = getComponentValue(setup.components.ArrivalTime, getEntityIdFromKeys([BigInt(entityId)]));

  const depositEntityId = getOwnedEntityOnPosition(entityId);

  const entityState = determineEntityState(
    nextBlockTimestamp,
    false,
    arrivalTime?.arrives_at,
    inventoryResources.length > 0,
  );

  const onOffload = async (receiverEntityId: ID) => {
    setIsLoading(true);
    if (entityId && inventoryResources.length > 0) {
      await setup.systemCalls
        .send_resources({
          sender_entity_id: entityId,
          recipient_entity_id: receiverEntityId,
          resources: inventoryResources.flatMap((resource) => [resource.resourceId, resource.amount]),
          signer: account.account,
        })
        .finally(() => setIsLoading(false));
    }
  };

  return (
    depositEntityId !== undefined &&
    inventoryResources.length > 0 && (
      <div className="w-full">
        <Button
          size="md"
          className="w-full"
          isLoading={isLoading}
          disabled={entityState === EntityState.Traveling || battleInProgress || armyInBattle}
          onClick={() => onOffload(depositEntityId)}
          variant="primary"
          withoutSound
        >
          {battleInProgress || armyInBattle
            ? `${armyInBattle ? "Army in battle" : "Battle in progress"}`
            : `Deposit Resources`}
        </Button>
      </div>
    )
  );
};
