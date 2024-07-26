import { useDojo } from "@/hooks/context/DojoContext";
import { getBattleByPosition } from "@/hooks/helpers/battles/useBattles";
import { getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { getResourcesUtils, useOwnedEntitiesOnPosition } from "@/hooks/helpers/useResources";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "@/ui/components/cityview/realm/labor/laborUtils";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { EntityState, EntityType, determineEntityState } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo, useState } from "react";
import { DepositResources } from "../resources/DepositResources";
import { TravelEntityPopup } from "./TravelEntityPopup";

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
  const {
    setup: {
      components: { Battle, Army },
    },
  } = useDojo();
  const [showTravel, setShowTravel] = useState(false);
  const { getEntityInfo } = getEntitiesUtils();
  const { getResourcesFromBalance } = getResourcesUtils();
  const { getOwnedEntityOnPosition } = useOwnedEntitiesOnPosition();
  const nextBlockTimestamp = useBlockchainStore.getState().nextBlockTimestamp;
  const { getArmy } = getArmyByEntityId();

  const entity = getEntityInfo(entityId);
  const entityResources = getResourcesFromBalance(entityId);
  const hasResources = entityResources.length > 0;
  const entityState = determineEntityState(
    nextBlockTimestamp,
    entity.blocked,
    Number(entity.arrivalTime),
    hasResources,
  );
  const depositEntityId = getOwnedEntityOnPosition(entityId);
  const getBattle = getBattleByPosition();

  const battleInProgress = useMemo(() => {
    const battleAtPosition = entity?.position
      ? getBattle({ x: Number(entity.position.x), y: Number(entity.position.y) })
      : undefined;
    return battleAtPosition && battleAtPosition.duration_left > 0;
  }, [entity?.position?.x, entity?.position?.y]);

  const army = getArmy(entityId);

  if (entityState === EntityState.NotApplicable) return null;

  const renderEntityStatus = () => {
    switch (entityState) {
      case EntityState.WaitingForDeparture:
        return <div className="flex ml-auto italic">Waiting...</div>;
      case EntityState.Idle:
      case EntityState.WaitingToOffload:
        return depositEntityId !== undefined && hasResources ? (
          <div className="flex ml-auto italic">Waiting to offload</div>
        ) : (
          <div className="flex ml-auto italic">Idle</div>
        );
      case EntityState.Traveling:
        return entity.arrivalTime && nextBlockTimestamp ? (
          <div className="flex ml-auto -mt-2 italic self-center">
            {formatSecondsLeftInDaysHours(Number(entity.arrivalTime) - nextBlockTimestamp)}
          </div>
        ) : null;
      default:
        return null;
    }
  };

  const renderResources = () => {
    if (entityState === EntityState.Idle || entityState === EntityState.WaitingForDeparture) return null;

    return entity.resources?.map(
      (resource: any) =>
        resource && (
          <ResourceCost
            key={resource.resourceId}
            className="!text-gold"
            type="vertical"
            size="xs"
            resourceId={resource.resourceId}
            amount={divideByPrecision(resource.amount)}
          />
        ),
    );
  };

  const name = entity.entityType === EntityType.TROOP ? army.name : entityName[entity.entityType];

  const bgColour = entityState === EntityState.Traveling ? "bg-gold/10" : "bg-green/10 animate-pulse";

  return (
    <div
      className={clsx("flex flex-col p-2 clip-angled-sm  text-gold border border-gold/10", props.className, bgColour)}
      onClick={props.onClick}
    >
      {showTravel && <TravelEntityPopup entityId={entityId} onClose={() => setShowTravel(false)} />}
      <div className="flex items-center text-xs flex-wrap">
        <div className="w-full flex justify-between">
          <div className="flex gap-3 font-bold">
            <span> {entityIcon[entity.entityType]}</span>
            <span>{name}</span>
          </div>

          <div className="flex items-center gap-1 self-center">
            {renderEntityStatus()}
            {/* <span>{entityState === EntityState.Traveling ? "Traveling" : "Resting"}</span> */}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap my-2">{renderResources()}</div>
      {entityState !== EntityState.Traveling && (
        <DepositResources entityId={entityId} battleInProgress={battleInProgress} />
      )}
    </div>
  );
};
