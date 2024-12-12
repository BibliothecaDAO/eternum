import { addToSubscription } from "@/dojo/queries";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import { getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useResourcesUtils } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision, formatTime, getEntityIdFromKeys } from "@/ui/utils/utils";
import { EntityType } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import { DepositResources } from "../resources/DepositResources";

const entityIcon: Record<EntityType, string> = {
  [EntityType.DONKEY]: "🫏",
  [EntityType.TROOP]: "🥷",
  [EntityType.UNKNOWN]: "❓", // Add a default or placeholder icon for UNKNOWN
};

const entityName: Record<EntityType, string> = {
  [EntityType.DONKEY]: "Donkeys",
  [EntityType.TROOP]: "Army",
  [EntityType.UNKNOWN]: "❓", // Add a default or placeholder icon for UNKNOWN
};

type EntityProps = {
  arrival: ArrivalInfo;
} & React.HTMLAttributes<HTMLDivElement>;

export const EntityArrival = ({ arrival, ...props }: EntityProps) => {
  const dojo = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);

  const { getEntityInfo, getEntityName } = useEntitiesUtils();
  const { getResourcesFromBalance } = useResourcesUtils();
  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;
  const { getArmy } = getArmyByEntityId();

  const weight = useComponentValue(dojo.setup.components.Weight, getEntityIdFromKeys([BigInt(arrival.entityId)]));

  const entity = getEntityInfo(arrival.entityId);

  const entityResources = useMemo(() => {
    return getResourcesFromBalance(arrival.entityId);
  }, [weight]);

  useEffect(() => {
    if (entityResources.length === 0) {
      setIsSyncing(true);
      const fetch = async () => {
        try {
          await addToSubscription(
            dojo.network.toriiClient,
            dojo.network.contractComponents as any,
            arrival.entityId.toString(),
          );
        } catch (error) {
          console.error("Fetch failed", error);
        } finally {
          setIsSyncing(false);
        }
      };
      fetch();
    }
  }, [arrival.entityId, dojo.network.toriiClient, dojo.network.contractComponents, entityResources.length]);

  const army = useMemo(() => getArmy(arrival.entityId), [arrival.entityId, entity.resources]);

  const renderEntityStatus = useMemo(() => {
    return nextBlockTimestamp ? (
      arrival.arrivesAt <= nextBlockTimestamp ? (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          Waiting to offload to {getEntityName(arrival.recipientEntityId)}
        </div>
      ) : (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          {formatTime(Number(entity.arrivalTime) - nextBlockTimestamp)}
        </div>
      )
    ) : null;
  }, [nextBlockTimestamp, arrival.recipientEntityId, arrival.hasResources, entity.arrivalTime]);

  const renderedResources = useMemo(() => {
    if (isSyncing) {
      return <div className="text-gold/50 italic">Syncing resources...</div>;
    }

    return entityResources
      .filter(Boolean)
      .map((resource) => (
        <ResourceCost
          key={resource.resourceId}
          className="!text-gold"
          type="vertical"
          size="xs"
          resourceId={resource.resourceId}
          amount={divideByPrecision(resource.amount)}
        />
      ));
  }, [entityResources, isSyncing]);

  const name = entity.entityType === EntityType.TROOP ? army?.name : entityName[entity.entityType];

  return (
    <div
      className={clsx("flex flex-col p-2 text-gold border border-gold/10", props.className, "bg-gold/10")}
      onClick={props.onClick}
    >
      <div className="flex justify-between">
        {" "}
        <div className="flex gap-2">
          <div className="flex gap-8 items-center">
            {entityIcon[entity.entityType]}
            <span className="truncate">{name}</span>
          </div>
          {renderEntityStatus}
        </div>
        <div className="flex justify-between items-center self-center">
          <DepositResources resources={entityResources} arrival={arrival} armyInBattle={Boolean(army?.battle_id)} />
        </div>
      </div>

      {entity.entityType === EntityType.TROOP && <ArmyCapacity army={army} className="mt-4" />}

      {renderedResources && <div className="flex items-center gap-2 flex-wrap mt-4">{renderedResources}</div>}
    </div>
  );
};
