import { ResourceInventoryManager } from "@/dojo/modelManager/ResourceInventoryManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ID, Resource } from "@bibliothecadao/eternum";
import { useState } from "react";
import { Entity } from "../entities/Entity";
import { HintSection } from "../hints/HintModal";

export type EntityReadyForDeposit = {
  carrierId: ID;
  senderEntityId: ID;
  recipientEntityId: ID;
  resources: Resource[];
};

export const AllResourceArrivals = ({ arrivals, className }: { arrivals: ArrivalInfo[]; className?: string }) => {
  const { setup } = useDojo();
  // stone as proxy for depoisiting resources
  const { play: playDeposit } = useUiSounds(soundSelector.addStone);

  const [entitiesReadyForDeposit, setEntitiesReadyForDeposit] = useState<EntityReadyForDeposit[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const inventoryManager = new ResourceInventoryManager(setup, 0);

  const onOffload = async () => {
    setIsLoading(true);
    playDeposit();
    await inventoryManager
      .onOffloadAllMultiple(
        entitiesReadyForDeposit
          .filter((entity) => arrivals.some((arrival) => arrival.entityId === entity.carrierId))
          .map((entity) => ({
            senderEntityId: entity.senderEntityId,
            recipientEntityId: entity.recipientEntityId,
            resources: entity.resources,
          })),
      )
      .finally(() => setIsLoading(false));
  };

  return (
    <div className={`p-2 flex flex-col space-y-1 overflow-y-auto gap-2 ${className ? className : ""}`}>
      <Headline>
        <div className="flex gap-2">
          <div className="self-center">Transfers</div>
          <HintModalButton section={HintSection.Transfers} />
        </div>
      </Headline>
      <Button
        size="xs"
        className="w-20 mx-auto"
        isLoading={isLoading}
        onClick={onOffload}
        variant="primary"
        disabled={isLoading || !entitiesReadyForDeposit.length || !arrivals.length}
      >
        {isLoading ? "Offloading..." : "Deposit All"}
      </Button>
      {!arrivals.length && <div className="text-center">No resource arrivals yet.</div>}
      {arrivals.map((arrival) => {
        return (
          <Entity
            setEntitiesReadyForDeposit={setEntitiesReadyForDeposit}
            key={arrival.entityId}
            entityId={arrival.entityId}
          />
        );
      })}
    </div>
  );
};
