import { useDojo } from "@/hooks/context/DojoContext";
import { useOwnedEntitiesOnPosition, useResources } from "@/hooks/helpers/useResources";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { EntityState, Resource, determineEntityState } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useState } from "react";

type DepositResourcesProps = {
  entityId: bigint;
  resources: Resource[];
};

export const DepositResources = ({ entityId, resources }: DepositResourcesProps) => {
  const { account, setup } = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  const nextBlockTimestamp = useBlockchainStore.getState().nextBlockTimestamp;
  const { getOwnedEntityOnPosition } = useOwnedEntitiesOnPosition();

  const arrivalTime = getComponentValue(setup.components.ArrivalTime, getEntityIdFromKeys([entityId]));

  const depositEntityId = getOwnedEntityOnPosition(entityId);

  const entityState = determineEntityState(nextBlockTimestamp, false, arrivalTime?.arrives_at, resources.length > 0);

  const onOffload = async (receiverEntityId: bigint) => {
    setIsLoading(true);
    if (entityId && resources.length > 0) {
      await setup.systemCalls
        .send_resources({
          sender_entity_id: entityId,
          recipient_entity_id: receiverEntityId,
          resources: resources.flatMap((resource) => [resource.resourceId, resource.amount]),
          signer: account.account,
        })
        .finally(() => setIsLoading(false));
    }
  };

  return (
    <div className="w-full">
      {depositEntityId !== undefined && resources.length > 0 && (
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
