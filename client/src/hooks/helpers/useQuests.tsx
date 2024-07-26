import { useCallback, useEffect, useMemo, useState } from "react";
import { BuildingType, QuestType, StructureType } from "@bibliothecadao/eternum";
import { useDojo } from "../context/DojoContext";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEntities } from "./useEntities";
import { ArmyInfo, useArmiesByEntityOwner } from "./useArmies";
import { useGetMyOffers } from "./useTrade";
import { getPillageEvents } from "@/dojo/events/pillageEventQueries";
import { QuestId, questDetails } from "@/ui/components/quest/questDetails";

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

  const createQuest = useCallback(
    (questId: QuestId) => {
      const dependency = questDependencies[questId];
      return {
        id: questId,
        ...questDetails.get(questId)!,
        status: dependency.status,
      };
    },
    [questDependencies],
  );

  const quests = useMemo(
    () => [
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
    ],
    [createQuest],
  );

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

  const entityUpdate = useEntityQuery([HasValue(EntityOwner, { entity_owner_id: BigInt(realmEntityId || "0") })]);

  const buildingQuantities = useBuildingQuantities(realmEntityId);

  const { entityArmies } = useArmiesByEntityOwner({ entity_owner_entity_id: realmEntityId || BigInt("0") });
  const orders = useGetMyOffers();

  const hasTroops = useMemo(() => armyHasTroops(entityArmies), [entityArmies]);
  const hasTraveled = useMemo(() => armyHasTraveled(entityArmies, realm?.position), [entityArmies, realm?.position]);

  const [pillageHistoryLength, setPillageHistoryLength] = useState<number>(0);

  useEffect(() => {
    const fetchPillageHistory = async () => {
      const eventsLength = await getPillageEvents(BigInt(realmEntityId ?? "0"));
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
    () => runQuery([HasValue(Contribution, { player_address: BigInt(account.address) })]).size,
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
        status:
          buildingQuantities.farms > 0
            ? questClaimStatus[QuestId.BuildFarm]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.BuildResource]: {
        value: questClaimStatus[QuestId.BuildResource] ? null : buildingQuantities.resource,
        status:
          buildingQuantities.resource > 0
            ? questClaimStatus[QuestId.BuildResource]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.CreateTrade]: {
        value: questClaimStatus[QuestId.CreateTrade] ? null : orders.length,
        status:
          orders.length > 0
            ? questClaimStatus[QuestId.CreateTrade]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.CreateArmy]: {
        value: questClaimStatus[QuestId.CreateArmy]
          ? { armyCount: null, hasTroops: null }
          : { armyCount: entityArmies.length, hasTroops },
        status:
          entityArmies.length > 0 && hasTroops
            ? questClaimStatus[QuestId.CreateArmy]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Travel]: {
        value: questClaimStatus[QuestId.Travel] ? null : hasTraveled,
        status: hasTraveled
          ? questClaimStatus[QuestId.Travel]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      },
      [QuestId.BuildWorkersHut]: {
        value: questClaimStatus[QuestId.BuildWorkersHut] ? null : buildingQuantities.workersHut,
        status:
          buildingQuantities.workersHut > 0
            ? questClaimStatus[QuestId.BuildWorkersHut]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Market]: {
        value: questClaimStatus[QuestId.Market] ? null : buildingQuantities.markets,
        status:
          buildingQuantities.markets > 0
            ? questClaimStatus[QuestId.Market]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Pillage]: {
        value: questClaimStatus[QuestId.Pillage] ? null : pillageHistoryLength,
        status:
          pillageHistoryLength > 0
            ? questClaimStatus[QuestId.Pillage]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Mine]: {
        value: questClaimStatus[QuestId.Mine] ? null : fragmentMines,
        status:
          fragmentMines > 0
            ? questClaimStatus[QuestId.Mine]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Contribution]: {
        value: questClaimStatus[QuestId.Contribution] ? null : hyperstructureContributions,
        status:
          hyperstructureContributions > 0
            ? questClaimStatus[QuestId.Contribution]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Hyperstructure]: {
        value: questClaimStatus[QuestId.Hyperstructure] ? null : hyperstructures,
        status:
          hyperstructures > 0
            ? questClaimStatus[QuestId.Hyperstructure]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
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

  const prizeUpdate = useEntityQuery([
    HasValue(HasClaimedStartingResources, { entity_id: BigInt(realmEntityId || "0") }),
  ]);

  const checkPrizesClaimed = (prizes: Prize[]) => {
    return prizes.every((prize) => {
      const value = getComponentValue(
        HasClaimedStartingResources,
        getEntityIdFromKeys([BigInt(realmEntityId || "0"), BigInt(prize.id)]),
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

const useBuildingQuantities = (realmEntityId: bigint | undefined) => {
  const {
    setup: {
      components: { BuildingQuantityv2, EntityOwner },
    },
  } = useDojo();
  const entityUpdate = useEntityQuery([HasValue(EntityOwner, { entity_owner_id: BigInt(realmEntityId || "0") })]);
  const getBuildingQuantity = (buildingType: BuildingType) =>
    getComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(realmEntityId || "0"), BigInt(buildingType)]))
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

const armyHasTroops = (entityArmies: ArmyInfo[]) => {
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
