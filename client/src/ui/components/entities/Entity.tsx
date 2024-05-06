import React, { useMemo } from "react";
import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import clsx from "clsx";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "@/ui/components/cityview/realm/labor/laborUtils";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { useGetOwnedEntityOnPosition, useResources } from "@/hooks/helpers/useResources";
import { useDojo } from "@/hooks/context/DojoContext";
import { TravelEntityPopup } from "./TravelEntityPopup";
import { useEntities } from "@/hooks/helpers/useEntities";
import { ENTITY_TYPE, EntityState, determineEntityState } from "@bibliothecadao/eternum";
import { DepositResources } from "../resources/DepositResources";

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
  const { getEntityInfo } = useEntities();
  const entityInfo = getEntityInfo(entityId);
  const { position, arrivalTime, blocked, capacity, resources, entityType } = entityInfo;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const {
    account: { account },
    setup: {
      systemCalls: { send_resources },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = React.useState(false);
  const [showTravel, setShowTravel] = React.useState(false);

  const { getResourcesFromBalance } = useResources();

  const entityResources = getResourcesFromBalance(entityId);
  const depositEntityIds = position ? useGetOwnedEntityOnPosition(BigInt(account.address), position) : [];
  const depositEntityId = depositEntityIds[0];

  const hasResources = entityResources.length > 0;

  const entityState = determineEntityState(nextBlockTimestamp, blocked, arrivalTime, hasResources);
  if (entityState === EntityState.NotApplicable) {
    return null;
  }

  const onOffload = async (receiverEntityId: bigint) => {
    setIsLoading(true);
    if (entityId && hasResources) {
      await send_resources({
        sender_entity_id: entityId,
        recipient_entity_id: receiverEntityId,
        resources: entityResources.flatMap((resource) => [resource.resourceId, resource.amount]),
        signer: account,
      }).finally(() => setIsLoading(false));
    }
  };

  const onCloseTravel = () => {
    setShowTravel(false);
  };

  return (
    <div
      className={clsx("flex flex-col p-2 border  border-gold text-xs text-gray-gold", props.className)}
      onClick={props.onClick}
    >
      {showTravel && <TravelEntityPopup entityId={entityId} onClose={onCloseTravel} />}
      <div className="flex items-center text-xxs">
        <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
          #{Number(entityId)}
        </div>
        <div className="flex items-center ml-1 -mt-2">
          {entityState !== EntityState.Traveling && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">{`Waiting`}</span>
            </div>
          )}
          {entityState === EntityState.Traveling && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">{`Traveling`}</span>
            </div>
          )}
        </div>
        {entityState === EntityState.WaitingForDeparture && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Trade Bound <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {entityState === EntityState.WaitingToOffload && (
          <div className="flex ml-auto -mt-2 italic text-gold">Waiting to offload</div>
        )}
        {entityState === EntityState.Idle && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {arrivalTime && entityState === EntityState.Traveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex justify-center items-center space-x-2 flex-wrap mt-2">
        {entityState !== EntityState.Idle &&
          entityState !== EntityState.WaitingForDeparture &&
          resources &&
          resources.map(
            (resource) =>
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
