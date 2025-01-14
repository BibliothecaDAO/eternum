import { useDojo } from "@/hooks/context/dojo-context";
import { useGetArmyByEntityId } from "@/hooks/helpers/use-armies";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import useNextBlockTimestamp from "@/hooks/use-next-block-timestamp";
import { DepositResources } from "@/ui/components/resources/deposit-resources";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { divideByPrecision, formatTime, getEntityIdFromKeys } from "@/ui/utils/utils";
import { getEntityInfo, getEntityName } from "@/utils/entities";
import { getResourcesFromBalance } from "@/utils/resources";
import { ContractAddress, EntityType } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import React, { useMemo } from "react";

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

  const components = dojo.setup.components;

  const { nextBlockTimestamp } = useNextBlockTimestamp();
  const { getArmy } = useGetArmyByEntityId();

  const weight = useComponentValue(dojo.setup.components.Weight, getEntityIdFromKeys([BigInt(arrival.entityId)]));

  const entity = getEntityInfo(arrival.entityId, ContractAddress(dojo.account.account.address), dojo.setup.components);

  const entityResources = useMemo(() => {
    return getResourcesFromBalance(arrival.entityId, components);
  }, [weight]);

  const army = useMemo(() => getArmy(arrival.entityId), [arrival.entityId, entity.resources]);

  const renderEntityStatus = useMemo(() => {
    return nextBlockTimestamp ? (
      arrival.arrivesAt <= nextBlockTimestamp ? (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          Waiting to offload to {getEntityName(arrival.recipientEntityId, components)}
        </div>
      ) : (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          Arriving in {formatTime(Number(entity.arrivalTime) - nextBlockTimestamp)} to{" "}
          {getEntityName(arrival.recipientEntityId, components)}
        </div>
      )
    ) : null;
  }, [nextBlockTimestamp, arrival.recipientEntityId, arrival.hasResources, entity.arrivalTime]);

  const renderedResources = useMemo(() => {
    return entityResources
      .filter(Boolean)
      .map((resource) => (
        <ResourceCost
          key={resource.resourceId}
          className="!text-gold"
          type="vertical"
          size="xs"
          withTooltip={true}
          resourceId={resource.resourceId}
          amount={divideByPrecision(resource.amount)}
        />
      ));
  }, [entityResources]);

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
