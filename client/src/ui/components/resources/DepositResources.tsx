import { ResourceInventoryManager } from "@/dojo/modelManager/ResourceInventoryManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useOwnedEntitiesOnPosition, useResourcesUtils } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { EntityState, ID, determineEntityState } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { EntityReadyForDeposit } from "../trading/ResourceArrivals";

type DepositResourcesProps = {
  entityId: ID;
  battleInProgress?: boolean;
  armyInBattle: boolean;
  setEntitiesReadyForDeposit: React.Dispatch<React.SetStateAction<EntityReadyForDeposit[]>>;
};

export const DepositResources = ({
  entityId,
  battleInProgress,
  armyInBattle,
  setEntitiesReadyForDeposit,
}: DepositResourcesProps) => {
  const { setup } = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  // stone as proxy for depoisiting resources
  const { play: playDeposit } = useUiSounds(soundSelector.addStone);

  const { getResourcesFromBalance } = useResourcesUtils();

  const inventoryResources = getResourcesFromBalance(entityId);

  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;
  const { getOwnedEntityOnPosition } = useOwnedEntitiesOnPosition();

  const arrivalTime = getComponentValue(setup.components.ArrivalTime, getEntityIdFromKeys([BigInt(entityId)]));
  const weight = useComponentValue(setup.components.Weight, getEntityIdFromKeys([BigInt(entityId)]))?.value || 0n;

  const depositEntityId = getOwnedEntityOnPosition(entityId);

  const entityState = determineEntityState(
    nextBlockTimestamp,
    false,
    arrivalTime?.arrives_at,
    inventoryResources.length > 0,
  );

  const depositManager = useMemo(() => {
    return new ResourceInventoryManager(setup, entityId);
  }, [setup, entityId]);

  useEffect(() => {
    if (depositEntityId && entityId && inventoryResources.length > 0) {
      setEntitiesReadyForDeposit((prev) => {
        if (prev.some((entity) => entity.senderEntityId === entityId && entity.recipientEntityId === depositEntityId)) {
          return prev;
        }
        return [
          ...prev,
          {
            // here entity id is the id of the entity that carries the resources
            carrierId: arrivalTime?.entity_id || 0,
            senderEntityId: entityId,
            recipientEntityId: depositEntityId,
            resources: inventoryResources,
          },
        ];
      });
    }
  }, []);

  const onOffload = async (receiverEntityId: ID) => {
    if (entityId && inventoryResources.length > 0) {
      playDeposit();
      setIsLoading(true);
      await depositManager.onOffloadAll(receiverEntityId, inventoryResources).then(() => {
        setIsLoading(false);
      });
    }
  };

  return (
    depositEntityId !== undefined && (
      <div className="w-full">
        <Button
          size="xs"
          className="w-full"
          isLoading={isLoading}
          disabled={
            entityState === EntityState.Traveling || battleInProgress || armyInBattle || inventoryResources.length === 0
          }
          onClick={() => onOffload(depositEntityId)}
          variant="primary"
          withoutSound
        >
          {battleInProgress || armyInBattle
            ? `${armyInBattle ? "Army in battle" : "Battle in progress"}`
            : inventoryResources.length === 0 && weight > 0n
              ? "Resources syncing..."
              : inventoryResources.length === 0 && weight === 0n
                ? "No resources to deposit"
                : "Deposit Resources"}
        </Button>
      </div>
    )
  );
};
