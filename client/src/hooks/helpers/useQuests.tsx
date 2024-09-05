import { getPillageEvents } from "@/dojo/events/pillageEventQueries";
import { QuestId, questDetails } from "@/ui/components/quest/questDetails";
import { BuildingType, ContractAddress, ID, QuestType, StructureType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDojo } from "../context/DojoContext";
import { ArmyInfo, useArmiesByEntityOwner } from "./useArmies";
import { useEntities } from "./useEntities";
import { useGetMyOffers } from "./useTrade";

export interface Quest {
  id: QuestId;
  name: string;
  description: string;
  steps: string[];
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

  const createQuest = (questId: QuestId) => {
    const dependency = questDependencies[questId];
    return useMemo(
      () => ({
        id: questId,
        ...questDetails.get(questId)!,
        status: dependency.status,
      }),
      [questDependencies[questId]],
    );
  };

  const quests = [
    createQuest(QuestId.Settle),
    createQuest(QuestId.BuildFarm),
    createQuest(QuestId.BuildResource),
    createQuest(QuestId.CreateTrade),
    createQuest(QuestId.CreateArmy),
    createQuest(QuestId.Travel),
    createQuest(QuestId.BuildWorkersHut),
    createQuest(QuestId.Market),
    createQuest(QuestId.Pillage),
    createQuest(QuestId.Mine),
    createQuest(QuestId.Contribution),
    createQuest(QuestId.Hyperstructure),
  ];

  return { quests };
};

const useQuestDependencies = () => {
  const {
    setup: {
      components: { Contribution, EntityOwner },
    },
    account: { account },
  } = useDojo();

  const { playerRealms } = useEntities();
  const realm = useMemo(() => playerRealms()[0], [playerRealms]);
  const realmEntityId = useMemo(() => realm?.entity_id, [realm]);

  const entityUpdate = useEntityQuery([HasValue(EntityOwner, { entity_owner_id: realmEntityId || 0 })]);

  const buildingQuantities = useBuildingQuantities(realmEntityId);

  const { entityArmies } = useArmiesByEntityOwner({ entity_owner_entity_id: realmEntityId || 0 });
  const orders = useGetMyOffers();

  const hasTroops = useMemo(() => armyHasTroops(entityArmies), [entityArmies]);
  const hasTraveled = useMemo(() => armyHasTraveled(entityArmies, realm?.position), [entityArmies, realm?.position]);

  const [pillageHistoryLength, setPillageHistoryLength] = useState<number>(0);

  useEffect(() => {
    const fetchPillageHistory = async () => {
      const eventsLength = await getPillageEvents(realmEntityId || 0);
      setPillageHistoryLength(eventsLength);
    };
    fetchPillageHistory();
  }, [realmEntityId]);

  const { playerStructures } = useEntities();
  const structures = playerStructures();

  const countStructuresByCategory = useCallback(
    (category: string) => {
      return structures.filter((structure) => structure.category === category).length;
    },
    [structures],
  );

  const fragmentMines = useMemo(
    () => countStructuresByCategory(StructureType[StructureType.FragmentMine]),
    [realmEntityId],
  );

  const hyperstructures = useMemo(
    () => countStructuresByCategory(StructureType[StructureType.Hyperstructure]),
    [realmEntityId],
  );

  const hyperstructureContributions = useMemo(
    () => runQuery([HasValue(Contribution, { player_address: ContractAddress(account.address) })]).size,
    [realmEntityId],
  );

  const { questClaimStatus } = useQuestClaimStatus();
  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();

  return useMemo(
    () => ({
      [QuestId.Settle]: {
        value: true,
        status: questClaimStatus[QuestId.Settle] ? QuestStatus.Claimed : QuestStatus.Completed,
      },
      [QuestId.BuildFarm]: {
        value: questClaimStatus[QuestId.BuildFarm] ? null : buildingQuantities.farms,
        status: questClaimStatus[QuestId.BuildFarm]
          ? QuestStatus.Claimed
          : buildingQuantities.farms > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.BuildResource]: {
        value: questClaimStatus[QuestId.BuildResource] ? null : buildingQuantities.resource,
        status: questClaimStatus[QuestId.BuildResource]
          ? QuestStatus.Claimed
          : buildingQuantities.resource > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.CreateTrade]: {
        value: questClaimStatus[QuestId.CreateTrade] ? null : orders.length,
        status: questClaimStatus[QuestId.CreateTrade]
          ? QuestStatus.Claimed
          : orders.length > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.CreateArmy]: {
        value: questClaimStatus[QuestId.CreateArmy]
          ? { armyCount: null, hasTroops: null }
          : { armyCount: entityArmies.length, hasTroops },
        status: questClaimStatus[QuestId.CreateArmy]
          ? QuestStatus.Claimed
          : entityArmies.length > 0 && hasTroops
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Travel]: {
        value: questClaimStatus[QuestId.Travel] ? null : hasTraveled,
        status: questClaimStatus[QuestId.Travel]
          ? QuestStatus.Claimed
          : hasTraveled
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.BuildWorkersHut]: {
        value: questClaimStatus[QuestId.BuildWorkersHut] ? null : buildingQuantities.workersHut,
        status: questClaimStatus[QuestId.BuildWorkersHut]
          ? QuestStatus.Claimed
          : buildingQuantities.workersHut > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Market]: {
        value: questClaimStatus[QuestId.Market] ? null : buildingQuantities.markets,
        status: questClaimStatus[QuestId.Market]
          ? QuestStatus.Claimed
          : buildingQuantities.markets > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Pillage]: {
        value: questClaimStatus[QuestId.Pillage] ? null : pillageHistoryLength,
        status: questClaimStatus[QuestId.Pillage]
          ? QuestStatus.Claimed
          : pillageHistoryLength > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Mine]: {
        value: questClaimStatus[QuestId.Mine] ? null : fragmentMines,
        status: questClaimStatus[QuestId.Mine]
          ? QuestStatus.Claimed
          : fragmentMines > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Contribution]: {
        value: questClaimStatus[QuestId.Contribution] ? null : hyperstructureContributions,
        status: questClaimStatus[QuestId.Contribution]
          ? QuestStatus.Claimed
          : hyperstructureContributions > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Hyperstructure]: {
        value: questClaimStatus[QuestId.Hyperstructure] ? null : hyperstructures,
        status: questClaimStatus[QuestId.Hyperstructure]
          ? QuestStatus.Claimed
          : hyperstructures > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
    }),
    [questClaimStatus, unclaimedQuestsCount > 0 ? entityUpdate : null, unclaimedQuestsCount > 0 ? orders : null],
  );
};

export const useQuestClaimStatus = () => {
  const {
    setup: {
      components: { HasClaimedStartingResources },
    },
  } = useDojo();

  const { playerRealms } = useEntities();
  const realm = useMemo(() => playerRealms()[0], [playerRealms]);
  const realmEntityId = useMemo(() => realm?.entity_id, [realm]);

  const prizeUpdate = useEntityQuery([HasValue(HasClaimedStartingResources, { entity_id: realmEntityId || 0 })]);

  const checkPrizesClaimed = (prizes: Prize[]) => {
    return prizes.every((prize) => {
      const value = getComponentValue(
        HasClaimedStartingResources,
        getEntityIdFromKeys([BigInt(realmEntityId || 0), BigInt(prize.id)]),
      );
      return value?.claimed;
    });
  };

  const questClaimStatus = useMemo(() => {
    return Array.from(questDetails.keys()).reduce(
      (acc, questName) => ({
        ...acc,
        [questName]: checkPrizesClaimed(questDetails.get(questName)?.prizes || []),
      }),
      {} as Record<QuestId, boolean>,
    );
  }, [prizeUpdate]);

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

const useBuildingQuantities = (realmEntityId: ID | undefined) => {
  const {
    setup: {
      components: { BuildingQuantityv2, EntityOwner },
    },
  } = useDojo();
  const entityUpdate = useEntityQuery([HasValue(EntityOwner, { entity_owner_id: realmEntityId || 0 })]);
  const getBuildingQuantity = (buildingType: BuildingType) =>
    getComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(realmEntityId || 0), BigInt(buildingType)]))
      ?.value || 0;

  return useMemo(
    () => ({
      farms: getBuildingQuantity(BuildingType.Farm),
      resource: getBuildingQuantity(BuildingType.Resource),
      workersHut: getBuildingQuantity(BuildingType.WorkersHut),
      markets: getBuildingQuantity(BuildingType.Market),
    }),
    [realmEntityId, entityUpdate],
  );
};

export const armyHasTroops = (entityArmies: (ArmyInfo | undefined)[]) => {
  return (
    entityArmies &&
    entityArmies[0] &&
    (Number(entityArmies[0].troops.knight_count) != 0 ||
      Number(entityArmies[0].troops.crossbowman_count) != 0 ||
      Number(entityArmies[0].troops.paladin_count) != 0)
  );
};

const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  if (entityArmies && entityArmies[0] && realmPosition) {
    return entityArmies[0].position.x != realmPosition.x || entityArmies[0].position.y != realmPosition.y;
  }
  return false;
};
