import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { ResourceInventoryManager } from "@/dojo/modelManager/ResourceInventoryManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import { useStructureByEntityId } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { ID, Resource } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useMemo, useState } from "react";

type DepositResourcesProps = {
  arrival: ArrivalInfo;
  armyInBattle: boolean;
  resources: Resource[];
};

export const DepositResources = ({ arrival, resources, armyInBattle }: DepositResourcesProps) => {
  const dojo = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  // stone as proxy for depoisiting resources
  const { play: playDeposit } = useUiSounds(soundSelector.addStone);

  const structureAtPosition = useStructureByEntityId(arrival.recipientEntityId || 0);

  const battleInProgress = useMemo(() => {
    if (!structureAtPosition || !structureAtPosition.protector || structureAtPosition.protector.battle_id === 0) {
      return false;
    }
    const currentTimestamp = useUIStore.getState().nextBlockTimestamp;
    const battleManager = new BattleManager(structureAtPosition.protector.battle_id, dojo);

    const battleOngoing = battleManager.isBattleOngoing(currentTimestamp!);
    return battleOngoing && !battleManager.isSiege(currentTimestamp!);
  }, [structureAtPosition?.protector?.battle_id, dojo]);

  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp || 0;

  const weight =
    useComponentValue(dojo.setup.components.Weight, getEntityIdFromKeys([BigInt(arrival.entityId)]))?.value || 0n;

  const depositManager = useMemo(() => {
    return new ResourceInventoryManager(dojo.setup, arrival.entityId);
  }, [dojo.setup, arrival.entityId]);

  const onOffload = async (receiverEntityId: ID) => {
    if (resources.length > 0) {
      playDeposit();
      setIsLoading(true);
      await depositManager.onOffloadAll(receiverEntityId, resources).then(() => {
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
        disabled={arrival.arrivesAt > nextBlockTimestamp || battleInProgress || armyInBattle || resources.length === 0}
        onClick={() => onOffload(arrival.recipientEntityId)}
        variant="primary"
        withoutSound
      >
        {battleInProgress || armyInBattle
          ? `${armyInBattle ? "Army in battle" : "Battle in progress"}`
          : resources.length === 0 && weight > 0n
            ? "Resources syncing..."
            : resources.length === 0 && weight === 0n
              ? "No resources to deposit"
              : "Deposit Resources"}
      </Button>
    </div>
  );
};
