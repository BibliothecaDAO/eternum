import { armyHasTraveled, ContractAddress, getEntityInfo, QuestType, TileManager } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useArmiesByStructure, useBuildingQuantities, useDojo, useUIStore } from "../";
import { QUEST_DETAILS } from "../../constants";
import { Prize } from "../../types/quest";
import { useGetMyOffers } from "./use-trade";

export enum QuestStatus {
  InProgress,
  Completed,
  Claimed,
}

export const useQuests = () => {
  const questDependencies = useQuestDependencies();

  const questTypes = [
    QuestType.Settle,
    QuestType.BuildFood,
    QuestType.BuildResource,
    QuestType.PauseProduction,
    QuestType.CreateDefenseArmy,
    QuestType.CreateAttackArmy,
    QuestType.Travel,
    QuestType.CreateTrade,
  ];

  const quests = useMemo(() => {
    return questTypes.map((type) => ({
      id: type,
      ...QUEST_DETAILS[type],
      status: questDependencies[type].status,
    }));
  }, [questDependencies]);

  return quests;
};

const useQuestDependencies = () => {
  const { setup } = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const entityUpdate = useEntityQuery([
    HasValue(setup.components.EntityOwner, { entity_owner_id: structureEntityId || 0 }),
  ]);
  const buildingQuantities = useBuildingQuantities(structureEntityId);
  const { entityArmies } = useArmiesByStructure({
    structureEntityId: structureEntityId || 0,
  });
  const orders = useGetMyOffers();

  const structurePosition = useMemo(
    () =>
      getEntityInfo(structureEntityId, ContractAddress(setup.account.account.address), setup.components)?.position || {
        x: 0,
        y: 0,
      },
    [structureEntityId, getEntityInfo],
  );

  const tileManager = new TileManager(setup.components, setup.network.provider, {
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
  const unclaimedQuestsCount = useUnclaimedQuestsCount();

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

const useQuestClaimStatus = () => {
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

    const checkPrizesClaimed = (prizes: ReadonlyArray<Prize>) =>
      prizes.every(
        (prize) => getComponentValue(Quest, getEntityIdFromKeys([entityBigInt, BigInt(prize.id)]))?.completed,
      );

    return Object.keys(QUEST_DETAILS).reduce(
      (acc, questName) => {
        const questType = Number(questName) as QuestType;
        return {
          ...acc,
          [questType]: isNotSettler || checkPrizesClaimed(QUEST_DETAILS[questType].prizes),
        };
      },
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

  return unclaimedQuestsCount;
};
