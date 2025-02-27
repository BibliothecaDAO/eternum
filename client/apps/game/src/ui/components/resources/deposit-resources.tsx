import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import Button from "@/ui/elements/button";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { ArrivalInfo, ID, Resource, ResourceInventoryManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { useMemo, useState } from "react";

type DepositResourcesProps = {
  arrival: ArrivalInfo;
  resources: Resource[];
};

export const DepositResources = ({ arrival, resources }: DepositResourcesProps) => {
  const dojo = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  // stone as proxy for depoisiting resources
  const { play: playDeposit } = useUiSounds(soundSelector.addStone);

  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const weight = useComponentValue(
    dojo.setup.components.Resource,
    getEntityIdFromKeys([BigInt(arrival.entityId)]),
  )?.weight;

  const depositManager = useMemo(() => {
    return new ResourceInventoryManager(dojo.setup.components, dojo.network.provider, arrival.entityId);
  }, [dojo.setup, arrival.entityId]);

  const onOffload = async (receiverEntityId: ID) => {
    if (resources.length > 0) {
      playDeposit();
      setIsLoading(true);
      await depositManager.onOffloadAll(dojo.account.account, receiverEntityId, resources).then(() => {
        setIsLoading(false);
      });
    }
  };

  return (
    <div className="w-full">
      <Button
        size="xs"
        className="w-full"
        isLoading={isLoading}
        disabled={arrival.arrivesAt > currentBlockTimestamp || resources.length === 0}
        onClick={() => onOffload(arrival.recipientEntityId)}
        variant="primary"
        withoutSound
      >
        {resources.length === 0 && weight?.weight && weight.weight > 0n
          ? "Resources syncing..."
          : resources.length === 0 && weight?.weight && weight.weight === 0n
            ? "No resources to deposit"
            : "Deposit Resources"}
      </Button>
    </div>
  );
};
