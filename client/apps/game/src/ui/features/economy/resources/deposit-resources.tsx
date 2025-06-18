import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import Button from "@/ui/elements/button";
import { ConfirmationPopup } from "@/ui/features/economy/banking/confirmation-popup";
import { getBlockTimestamp } from "@/utils/timestamp";
import { ResourceArrivalManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ResourceArrivalInfo } from "@bibliothecadao/types";
import { AlertCircle } from "lucide-react";
import { useState } from "react";

export const DepositResources = ({
  isMaxCapacity,
  arrival,
}: {
  isMaxCapacity: boolean;
  arrival: ResourceArrivalInfo;
}) => {
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // stone as proxy for depositing resources
  const { play: playDeposit } = useUiSounds(soundSelector.addStone);

  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const onOffload = async () => {
    if (isMaxCapacity) {
      setShowConfirmation(true);
      return;
    }

    await processOffload();
  };

  const processOffload = async () => {
    const resourceArrivalManager = new ResourceArrivalManager(components, systemCalls, arrival);

    if (arrival.resources.length > 0) {
      setIsLoading(true);
      try {
        // todo: issue with entities updates
        await resourceArrivalManager.offload(account, arrival.resources.length);
      } finally {
        setIsLoading(false);
        playDeposit();
      }
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

      {showConfirmation && (
        <ConfirmationPopup
          title="Warning: Storage at Max Capacity"
          warning="You may lose resources if you deposit while at maximum capacity!"
          onConfirm={() => {
            setShowConfirmation(false);
            processOffload();
          }}
          onCancel={() => setShowConfirmation(false)}
          isLoading={isLoading}
        >
          <div className="flex flex-col items-center gap-3 text-amber-400">
            <AlertCircle className="w-12 h-12" />
            <p className="text-center">
              Your storage is at maximum capacity. Depositing these resources may result in some materials being lost.
            </p>
            <p className="text-center font-bold">Do you still want to proceed with the deposit?</p>
          </div>
        </ConfirmationPopup>
      )}
    </div>
  );
};
