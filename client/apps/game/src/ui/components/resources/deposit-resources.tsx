import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import Button from "@/ui/elements/button";
import { getBlockTimestamp } from "@/utils/timestamp";
import { ResourceArrivalInfo, ResourceArrivalManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useState } from "react";

export const DepositResourceArrival = ({ arrival }: { arrival: ResourceArrivalInfo }) => {
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  // stone as proxy for depositing resources
  const { play: playDeposit } = useUiSounds(soundSelector.addStone);

  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const onOffload = async () => {
    const resourceArrivalManager = new ResourceArrivalManager(components, systemCalls, arrival);

    if (arrival.resources.length > 0) {
      playDeposit();
      setIsLoading(true);

      try {
        // todo: issue with entities updates
        await resourceArrivalManager.offload(account, arrival.resources.length);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-full">
      <Button
        size="md"
        className="w-full"
        isLoading={isLoading}
        disabled={arrival.arrivesAt > currentBlockTimestamp}
        onClick={() => onOffload()}
        variant="primary"
        withoutSound
      >
        Deposit Resources
      </Button>
    </div>
  );
};
