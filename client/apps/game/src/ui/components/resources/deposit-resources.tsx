import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import Button from "@/ui/elements/button";
import { getBlockTimestamp } from "@/utils/timestamp";
import { ResourceArrivalInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useState } from "react";

type DepositResourcesProps = {
  arrival: ResourceArrivalInfo;
};

export const DepositResourceArrival = ({ arrival }: DepositResourcesProps) => {
  const dojo = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  // stone as proxy for depositing resources
  const { play: playDeposit } = useUiSounds(soundSelector.addStone);

  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const onOffload = async () => {
    if (arrival.resources.length > 0) {
      playDeposit();
      setIsLoading(true);
      const systemCall = dojo.setup.systemCalls.arrivals_offload({
        signer: dojo.account.account,
        structureId: arrival.structureEntityId,
        day: arrival.day,
        slot: arrival.slot,
        resource_count: arrival.resources.length,
      });
      systemCall.finally(() => {
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
