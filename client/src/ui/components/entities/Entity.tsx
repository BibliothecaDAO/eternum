import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { getResourcesUtils, useOwnedEntitiesOnPosition } from "@/hooks/helpers/useResources";
import { getStructureByEntityId } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision, formatTime } from "@/ui/utils/utils";
import { EntityState, EntityType, ID, determineEntityState } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useMemo } from "react";
import { DepositResources } from "../resources/DepositResources";

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
  entityId: ID;
  idleOnly?: boolean;
  selectedCaravan?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const Entity = ({ entityId, ...props }: EntityProps) => {
  const dojo = useDojo();

  const { getEntityInfo } = getEntitiesUtils();
  const { getResourcesFromBalance } = getResourcesUtils();
  const { getOwnedEntityOnPosition } = useOwnedEntitiesOnPosition();
  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;
  const { getArmy } = getArmyByEntityId();

  const entity = getEntityInfo(entityId);
  const entityResources = getResourcesFromBalance(entityId);
  const hasResources = entityResources.length > 0;
  const entityState = determineEntityState(nextBlockTimestamp, entity.blocked, entity.arrivalTime, hasResources);
  const depositEntityId = getOwnedEntityOnPosition(entityId);

  const structureAtPosition = getStructureByEntityId(depositEntityId || 0);

  const battleInProgress = useMemo(() => {
    if (!structureAtPosition || !structureAtPosition.protector || structureAtPosition.protector.battle_id === 0) {
      return false;
    }
    const currentTimestamp = useUIStore.getState().nextBlockTimestamp;
    const battleManager = new BattleManager(structureAtPosition.protector.battle_id, dojo);

    const battleOngoing = battleManager.isBattleOngoing(currentTimestamp!);
    return battleOngoing && !battleManager.isSiege(currentTimestamp!);
  }, [entity?.position?.x, entity?.position?.y]);

  const army = useMemo(() => getArmy(entityId), [entityId, entity.resources]);

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
            {formatTime(Number(entity.arrivalTime) - nextBlockTimestamp)}
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

  const name = entity.entityType === EntityType.TROOP ? army?.name : entityName[entity.entityType];

  const bgColour = entityState === EntityState.Traveling ? "bg-gold/10" : "bg-green/10";

  return (
    <div
      className={clsx("flex flex-col p-2   text-gold border border-gold/10", props.className, bgColour)}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xs flex-wrap">
        <div className="w-full flex justify-between">
          <div className="flex items-center gap-1 self-center">{renderEntityStatus()}</div>
        </div>
      </div>
      {entity.entityType === EntityType.TROOP && (
        <ArmyCapacity army={army} configManager={dojo.setup.configManager} className="my-2 ml-5" />
      )}
      <div className="flex items-center gap-2 flex-wrap my-2">{renderResources()}</div>
      <div className="flex justify-between items-center gap-8">
        {entityState !== EntityState.Traveling && (
          <DepositResources
            entityId={entityId}
            battleInProgress={battleInProgress}
            armyInBattle={Boolean(army?.battle_id)}
          />
        )}
        <div className="flex gap-3 text-xs items-center whitespace-nowrap">
          {entityIcon[entity.entityType]}
          <span className="truncate">{name}</span>
        </div>
      </div>
    </div>
  );
};
