import { TileManager } from "@/dojo/modelManager/TileManager";
import { questDetails } from "@/ui/components/quest/questDetails";
import { BuildingType, ContractAddress, ID, QuestType } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { HasValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { ArmyInfo, useArmiesByEntityOwnerWithPositionAndQuantity } from "./useArmies";
import { useEntitiesUtils } from "./useEntities";
import { useGetMyOffers } from "./useTrade";

export interface Quest {
  id: QuestType;
  view: string;
  name: string;
  description: string | React.ReactNode;
  steps: (string | React.ReactNode)[];
  prizes: Prize[];
  depth: number;
  status: QuestStatus;
}

export interface Prize {
  id: QuestType;
  title: string;
}

export enum QuestStatus {
  InProgress,
  Completed,
  Claimed,
}

export const useQuests = () => {
  const questDependencies = useQuestDependencies();

  const createQuest = (QuestType: QuestType) => {
    const dependency = questDependencies[QuestType];
    return useMemo(
      () => ({
        id: QuestType,
        ...questDetails.get(QuestType)!,
        status: dependency.status,
      }),
      [questDependencies[QuestType]],
    );
  };

  const quests = [
    createQuest(QuestType.Settle),
    createQuest(QuestType.BuildFood),
    createQuest(QuestType.BuildResource),
    createQuest(QuestType.PauseProduction),
    createQuest(QuestType.CreateDefenseArmy),
    createQuest(QuestType.CreateAttackArmy),
    createQuest(QuestType.Travel),
    createQuest(QuestType.CreateTrade),
  ];

  return { quests };
};

const useQuestDependencies = () => {
  const { setup } = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const entityUpdate = useEntityQuery([
    HasValue(setup.components.EntityOwner, { entity_owner_id: structureEntityId || 0 }),
  ]);
  const buildingQuantities = useBuildingQuantities(structureEntityId);
  const { entityArmies } = useArmiesByEntityOwnerWithPositionAndQuantity({
    entity_owner_entity_id: structureEntityId || 0,
  });
  const orders = useGetMyOffers();
  const { getEntityInfo } = useEntitiesUtils();

  const structurePosition = useMemo(
    () => getEntityInfo(structureEntityId)?.position || { x: 0, y: 0 },
    [structureEntityId, getEntityInfo],
  );

  const tileManager = new TileManager(setup, {
    col: structurePosition.x,
    row: structurePosition.y,
  });

  const existingBuildings = useMemo(() => tileManager.existingBuildings(), [structurePosition]);
  const hasAnyPausedBuilding = useMemo(
    () => existingBuildings.some((building) => building.paused),
    [existingBuildings],
  );

  const hasDefensiveArmy = useMemo(
    () => entityArmies.some((army) => army.protectee?.protectee_id === structureEntityId && army.quantity.value > 0n),
    [entityArmies],
  );
  const hasAttackingArmy = useMemo(
    () => entityArmies.some((army) => army.protectee === undefined && army.quantity.value > 0n),
    [entityArmies],
  );

  const hasTraveled = useMemo(
    () => armyHasTraveled(entityArmies, structurePosition),
    [entityArmies, structurePosition],
  );

  const { questClaimStatus } = useQuestClaimStatus();
  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();

  return useMemo(
    () => ({
      [QuestType.Settle]: {
        value: true,
        status: questClaimStatus[QuestType.Settle] ? QuestStatus.Claimed : QuestStatus.Completed,
      },
      [QuestType.BuildFood]: {
        value: questClaimStatus[QuestType.BuildFood] ? null : buildingQuantities.food,
        status: questClaimStatus[QuestType.BuildFood]
          ? QuestStatus.Claimed
          : buildingQuantities.food > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestType.BuildResource]: {
        value: questClaimStatus[QuestType.BuildResource] ? null : buildingQuantities.resource,
        status: questClaimStatus[QuestType.BuildResource]
          ? QuestStatus.Claimed
          : buildingQuantities.resource > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },

      [QuestType.PauseProduction]: {
        value: questClaimStatus[QuestType.PauseProduction] ? null : hasAnyPausedBuilding,
        status: questClaimStatus[QuestType.PauseProduction]
          ? QuestStatus.Claimed
          : hasAnyPausedBuilding
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },

      [QuestType.CreateDefenseArmy]: {
        value: questClaimStatus[QuestType.CreateDefenseArmy] ? null : hasDefensiveArmy,
        status: questClaimStatus[QuestType.CreateDefenseArmy]
          ? QuestStatus.Claimed
          : hasDefensiveArmy
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestType.CreateAttackArmy]: {
        value: questClaimStatus[QuestType.CreateAttackArmy] ? null : hasAttackingArmy,
        status: questClaimStatus[QuestType.CreateAttackArmy]
          ? QuestStatus.Claimed
          : hasAttackingArmy
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestType.Travel]: {
        value: questClaimStatus[QuestType.Travel] ? null : hasTraveled,
        status: questClaimStatus[QuestType.Travel]
          ? QuestStatus.Claimed
          : hasTraveled
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },

      [QuestType.CreateTrade]: {
        value: questClaimStatus[QuestType.CreateTrade] ? null : orders.length,
        status: questClaimStatus[QuestType.CreateTrade]
          ? QuestStatus.Claimed
          : orders.length > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
    }),
    [
      structureEntityId,
      questClaimStatus,
      unclaimedQuestsCount > 0 ? entityUpdate : null,
      unclaimedQuestsCount > 0 ? orders : null,
    ],
  );
};

export const useQuestClaimStatus = () => {
  const {
    setup: {
      components: { Quest, Realm },
    },
    account: { account },
  } = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const realmSettler = useComponentValue(Realm, getEntityIdFromKeys([BigInt(structureEntityId)]))?.settler_address;
  const isNotSettler = realmSettler !== ContractAddress(account.address);

  const prizeUpdate = useEntityQuery([HasValue(Quest, { entity_id: structureEntityId || 0 })]);

  const questClaimStatus = useMemo(() => {
    const entityBigInt = BigInt(structureEntityId || 0);

    const checkPrizesClaimed = (prizes: Prize[]) =>
      prizes.every(
        (prize) => getComponentValue(Quest, getEntityIdFromKeys([entityBigInt, BigInt(prize.id)]))?.completed,
      );

    return Array.from(questDetails.keys()).reduce(
      (acc, questName) => ({
        ...acc,
        [questName]: isNotSettler || checkPrizesClaimed(questDetails.get(questName)?.prizes || []),
      }),
      {} as Record<QuestType, boolean>,
    );
  }, [structureEntityId, isNotSettler, prizeUpdate, Quest]);

  return { questClaimStatus };
};

export const useUnclaimedQuestsCount = () => {
  const { questClaimStatus } = useQuestClaimStatus();

  const unclaimedQuestsCount = useMemo(
    () => Object.values(questClaimStatus).filter((claimed) => !claimed).length,
    [questClaimStatus],
  );

  return { unclaimedQuestsCount };
};

const useBuildingQuantities = (structureEntityId: ID | undefined) => {
  const {
    setup: {
      components: { BuildingQuantityv2 },
    },
  } = useDojo();
  const entityUpdate = useEntityQuery([HasValue(BuildingQuantityv2, { entity_id: structureEntityId || 0 })]);
  const getBuildingQuantity = (buildingType: BuildingType) =>
    getComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(structureEntityId || 0), BigInt(buildingType)]))
      ?.value || 0;

  return useMemo(
    () => ({
      food: getBuildingQuantity(BuildingType.Farm) + getBuildingQuantity(BuildingType.FishingVillage),
      resource: getBuildingQuantity(BuildingType.Resource),
      workersHut: getBuildingQuantity(BuildingType.WorkersHut),
      markets: getBuildingQuantity(BuildingType.Market),
    }),
    [structureEntityId, entityUpdate],
  );
};

export const armyHasTroops = (entityArmies: (ArmyInfo | undefined)[]) => {
  return entityArmies.some(
    (army) =>
      army &&
      (Number(army.troops.knight_count) !== 0 ||
        Number(army.troops.crossbowman_count) !== 0 ||
        Number(army.troops.paladin_count) !== 0),
  );
};

const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  return entityArmies.some(
    (army) => army && realmPosition && (army.position.x !== realmPosition.x || army.position.y !== realmPosition.y),
  );
};
