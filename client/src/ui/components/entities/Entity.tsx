import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useOwnedEntitiesOnPosition, useResourcesUtils } from "@/hooks/helpers/useResources";
import { useStructureByEntityId } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision, formatTime, getEntityIdFromKeys } from "@/ui/utils/utils";
import { EntityState, EntityType, ID, determineEntityState } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import React, { useMemo } from "react";
import { DepositResources } from "../resources/DepositResources";
import { EntityReadyForDeposit } from "../trading/ResourceArrivals";

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
  setEntitiesReadyForDeposit: React.Dispatch<React.SetStateAction<EntityReadyForDeposit[]>>;
} & React.HTMLAttributes<HTMLDivElement>;

export const Entity = ({ entityId, setEntitiesReadyForDeposit, ...props }: EntityProps) => {
  const dojo = useDojo();

  const { getEntityInfo, getEntityName } = useEntitiesUtils();
  const { getResourcesFromBalance } = useResourcesUtils();
  const { getOwnedEntityOnPosition } = useOwnedEntitiesOnPosition();
  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;
  const { getArmy } = getArmyByEntityId();

  const weight = useComponentValue(dojo.setup.components.Weight, getEntityIdFromKeys([BigInt(entityId)]));

  const entity = getEntityInfo(entityId);
  const entityResources = useMemo(() => {
    return getResourcesFromBalance(entityId);
  }, [weight]);

  const hasResources = entityResources.length > 0;
  const entityState = determineEntityState(nextBlockTimestamp, entity.blocked, entity.arrivalTime, hasResources);
  const depositEntityId = getOwnedEntityOnPosition(entityId);

  const structureAtPosition = useStructureByEntityId(depositEntityId || 0);

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
        return (
          <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
            Waiting...
          </div>
        );
      case EntityState.Idle:
      case EntityState.WaitingToOffload:
        return depositEntityId !== undefined && hasResources ? (
          <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
            Waiting to offload to {getEntityName(depositEntityId)}
          </div>
        ) : (
          <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">Idle</div>
        );
      case EntityState.Traveling:
        return entity.arrivalTime && nextBlockTimestamp ? (
          <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
            {formatTime(Number(entity.arrivalTime) - nextBlockTimestamp)}
          </div>
        ) : null;
      default:
        return null;
    }
  };

  const renderResources = () => {
    if (entityState === EntityState.Idle || entityState === EntityState.WaitingForDeparture) return null;

    return entityResources?.map(
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
      className={clsx("flex flex-col p-2 text-gold border border-gold/10", props.className, bgColour)}
      onClick={props.onClick}
    >
      <div className="flex justify-between">
        {" "}
        <div className="flex gap-2">
          <div className="flex gap-8 items-center">
            {entityIcon[entity.entityType]}
            <span className="truncate">{name}</span>
          </div>
          {renderEntityStatus()}
        </div>
        <div className="flex justify-between items-center self-center">
          {entityState !== EntityState.Traveling && (
            <DepositResources
              entityId={entityId}
              battleInProgress={battleInProgress}
              armyInBattle={Boolean(army?.battle_id)}
              setEntitiesReadyForDeposit={setEntitiesReadyForDeposit}
            />
          )}
        </div>
      </div>

      {entity.entityType === EntityType.TROOP && <ArmyCapacity army={army} className="mt-4" />}

      {renderResources() && <div className="flex items-center gap-2 flex-wrap mt-4">{renderResources()}</div>}
    </div>
  );
};
