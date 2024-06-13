import React from "react";
import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import clsx from "clsx";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "@/ui/components/cityview/realm/labor/laborUtils";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { useResources } from "@/hooks/helpers/useResources";
import { TravelEntityPopup } from "./TravelEntityPopup";
import { useEntities } from "@/hooks/helpers/useEntities";
import { EntityType, EntityState, determineEntityState } from "@bibliothecadao/eternum";
import { DepositResources } from "../resources/DepositResources";
import { useState } from "react";

const entityIcon: Record<EntityType, string> = {
  [EntityType.DONKEY]: "🫏",
  [EntityType.TROOP]: "🥷",
  [EntityType.UNKNOWN]: "❓", // Add a default or placeholder icon for UNKNOWN
};

const entityName: Record<EntityType, string> = {
  [EntityType.DONKEY]: "Trade Caravan",
  [EntityType.TROOP]: "Army",
  [EntityType.UNKNOWN]: "❓", // Add a default or placeholder icon for UNKNOWN
};

type EntityProps = {
  entityId: bigint;
  idleOnly?: boolean;
  selectedCaravan?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const Entity = ({ entityId, ...props }: EntityProps) => {
  const [showTravel, setShowTravel] = useState(false);

  const { getEntityInfo } = useEntities();
  const { getResourcesFromBalance } = useResources();

  const entity = getEntityInfo(entityId);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const entityResources = getResourcesFromBalance(entityId);

  const hasResources = entityResources.length > 0;

  const entityState = determineEntityState(nextBlockTimestamp, entity.blocked, entity.arrivalTime, hasResources);
  if (entityState === EntityState.NotApplicable) {
    return null;
  }

  const onCloseTravel = () => {
    setShowTravel(false);
  };

  return (
    <div
      className={clsx("flex flex-col p-2 clip-angled-sm bg-green/20 text-gold", props.className)}
      onClick={props.onClick}
    >
      {showTravel && <TravelEntityPopup entityId={entityId} onClose={onCloseTravel} />}
      {/* <div className="text-xs">{entity.isMine ? "Incoming" : "Outgoing"}</div> */}

      <div className="flex items-center text-xs flex-wrap">
        <div className="text-xl w-full flex justify-between">
          {entityName[entity.entityType]}
          <span>{entityIcon[entity.entityType]}</span>
        </div>

        <div className="flex items-center">
          <span>{entityState === EntityState.Traveling ? "Traveling" : "Resting"}</span>
        </div>

        {entityState === EntityState.WaitingForDeparture && (
          <div className="flex ml-auto  italic ">
            Trade Bound <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {entityState === EntityState.WaitingToOffload && <div className="flex ml-auto italic ">Waiting to offload</div>}

        {entityState === EntityState.Idle && (
          <div className="flex ml-auto  italic ">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}

        {entity.arrivalTime && entityState === EntityState.Traveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic ">
            {formatSecondsLeftInDaysHours(entity.arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex  items-center space-x-2 flex-wrap mt-2">
        {entityState !== EntityState.Idle &&
          entityState !== EntityState.WaitingForDeparture &&
          entity.resources &&
          entity.resources.map(
            (resource: any) =>
              resource && (
                <ResourceCost
                  key={resource.resourceId}
                  className="!text-gold "
                  type="vertical"
                  resourceId={resource.resourceId}
                  amount={divideByPrecision(resource.amount)}
                />
              ),
          )}
      </div>
      <DepositResources entityId={entityId} />
    </div>
  );
};
