import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { DepositResources } from "@/ui/components/resources/deposit-resources";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { divideByPrecision, getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  ArrivalInfo,
  ContractAddress,
  EntityType,
  formatTime,
  getArmy,
  getEntityInfo,
  getEntityName,
  getResourcesFromBalance,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
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

  const { currentBlockTimestamp, currentDefaultTick } = useBlockTimestamp();

  const weight = useComponentValue(dojo.setup.components.Weight, getEntityIdFromKeys([BigInt(arrival.entityId)]));

  const entity = useMemo(
    () =>
      getEntityInfo(
        arrival.entityId,
        ContractAddress(dojo.account.account.address),
        currentDefaultTick,
        dojo.setup.components,
      ),
    [arrival.entityId, dojo.account.account.address],
  );

  const entityResources = useMemo(() => {
    return getResourcesFromBalance(arrival.entityId, currentDefaultTick, components);
  }, [weight]);

  const army = useMemo(
    () => getArmy(arrival.entityId, ContractAddress(dojo.account.account.address), components),
    [arrival.entityId, entity.resources],
  );

  const renderEntityStatus = useMemo(() => {
    return currentBlockTimestamp ? (
      arrival.arrivesAt <= currentBlockTimestamp ? (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          Waiting to offload to {getEntityName(arrival.recipientEntityId, components)}
        </div>
      ) : (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          Arriving in {formatTime(Number(entity.arrivalTime) - currentBlockTimestamp)} to{" "}
          {getEntityName(arrival.recipientEntityId, components)}
        </div>
      )
    ) : null;
  }, [currentBlockTimestamp, arrival.recipientEntityId, arrival.hasResources, entity.arrivalTime]);

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
