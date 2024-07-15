import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { getResourcesUtils, useOwnedEntitiesOnPosition } from "@/hooks/helpers/useResources";
import { getStructureByEntityId } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "@/ui/components/cityview/realm/labor/laborUtils";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { EntityState, EntityType, determineEntityState } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo, useState } from "react";
import { DepositResources } from "../resources/DepositResources";
import { TravelEntityPopup } from "./TravelEntityPopup";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";

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
  const dojo = useDojo();

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

  const structureAtPosition = getStructureByEntityId(depositEntityId || 0n);

  const battleInProgress = useMemo(() => {
    if (!structureAtPosition || !structureAtPosition.protector || structureAtPosition.protector.battle_id === 0n) {
      return false;
    }
    const currentTimestamp = useBlockchainStore.getState().nextBlockTimestamp;
    const battleManager = new BattleManager(structureAtPosition.protector.battle_id, dojo);
    return battleManager.isBattleOngoing(currentTimestamp!);
  }, [entity?.position?.x, entity?.position?.y]);

  const army = useMemo(() => getArmy(entityId), [entityId]);

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

          <div className="flex items-center gap-1 self-center">{renderEntityStatus()}</div>
        </div>
      </div>
      {entity.entityType === EntityType.TROOP && <ArmyCapacity army={army} className="my-2 ml-5" />}
      <div className="flex items-center gap-2 flex-wrap my-2">{renderResources()}</div>
      {entityState !== EntityState.Traveling && (
        <DepositResources
          entityId={entityId}
          battleInProgress={battleInProgress}
          armyInBattle={Boolean(army.battle_id)}
        />
      )}
    </div>
  );
};
