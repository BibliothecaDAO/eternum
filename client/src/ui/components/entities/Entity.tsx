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
import { ENTITY_TYPE, EntityState, determineEntityState } from "@bibliothecadao/eternum";
import { DepositResources } from "../resources/DepositResources";
import { useState } from "react";

const entityIcon: Record<ENTITY_TYPE, string> = {
  [ENTITY_TYPE.DONKEY]: "🫏",
  [ENTITY_TYPE.TROOP]: "🥷",
  [ENTITY_TYPE.UNKNOWN]: "❓", // Add a default or placeholder icon for UNKNOWN
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

  const { arrivalTime, blocked, resources, entityType } = getEntityInfo(entityId);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const entityResources = getResourcesFromBalance(entityId);

  const hasResources = entityResources.length > 0;

  const entityState = determineEntityState(nextBlockTimestamp, blocked, arrivalTime, hasResources);
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

      <div className="flex items-center text-xs">
        {/* <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0  rounded-br-md border-gray-gold">
          #{Number(entityId)}
        </div> */}
        <div className="text-2xl">{entityIcon[entityType]}</div>

        <div className="flex items-center ml-1">
          <span className="italic ">{entityState === EntityState.Traveling ? "Traveling" : "Waiting"}</span>
        </div>
        {entityState === EntityState.WaitingForDeparture && (
          <div className="flex ml-auto  italic text-gold">
            Trade Bound <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {entityState === EntityState.WaitingToOffload && (
          <div className="flex ml-auto italic text-gold">Waiting to offload</div>
        )}
        {entityState === EntityState.Idle && (
          <div className="flex ml-auto  italic text-gold">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {arrivalTime && entityState === EntityState.Traveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic ">
            {formatSecondsLeftInDaysHours(arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex  items-center space-x-2 flex-wrap mt-2">
        {entityState !== EntityState.Idle &&
          entityState !== EntityState.WaitingForDeparture &&
          resources &&
          resources.map(
            (resource: any) =>
              resource && (
                <ResourceCost
                  key={resource.resourceId}
                  className="!text-gold !w-5 mt-0.5"
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
