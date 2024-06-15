import { useDojo } from "@/hooks/context/DojoContext";
import { useOwnedEntitiesOnPosition, useResources } from "@/hooks/helpers/useResources";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { EntityState, determineEntityState } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useState } from "react";

type DepositResourcesProps = {
  entityId: bigint;
};

export const DepositResources = ({ entityId }: DepositResourcesProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const { nextBlockTimestamp } = useBlockchainStore((state) => state);
  const { account, setup } = useDojo();
  const { getResourcesFromBalance } = useResources();
  const { getOwnedEntityOnPosition } = useOwnedEntitiesOnPosition();

  const inventoryResources = getResourcesFromBalance(BigInt(entityId));

  const arrivalTime = getComponentValue(setup.components.ArrivalTime, getEntityIdFromKeys([entityId]));

  const depositEntityId = getOwnedEntityOnPosition(entityId);

  const entityState = determineEntityState(
    nextBlockTimestamp,
    false,
    arrivalTime?.arrives_at,
    inventoryResources.length > 0,
  );

  const onOffload = async (receiverEntityId: bigint) => {
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
    <div className="w-full">
      {depositEntityId !== undefined && inventoryResources.length > 0 && (
        <Button
          size="md"
          className="w-full"
          isLoading={isLoading}
          disabled={entityState === EntityState.Traveling}
          onClick={() => onOffload(depositEntityId)}
          variant="primary"
          withoutSound
        >
          {`Deposit Resources`}
        </Button>
      )}
    </div>
  );
};
