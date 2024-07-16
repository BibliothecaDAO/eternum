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
import { QuestName, questDetails } from "@/ui/components/quest/QuestDetails";

export interface Quest {
  name: QuestName;
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
  const {
    buildingQuantities,
    entityArmies,
    orders,
    pillageHistoryLength,
    hasTroops,
    hasTraveled,
    fragmentMines,
    hyperstructures,
    hyperstructureContributions,
  } = useQuestDependencies();

  const {
    useSettleQuest,
    useBuildFarmQuest,
    useBuildResourceQuest,
    useCreateTradeQuest,
    useCreateArmyQuest,
    useTravelQuest,
    useBuildWorkersHutQuest,
    useMarketQuest,
    usePillageQuest,
    useMineQuest,
    useContributionQuest,
    useHyperstructureQuest,
  } = useBuildQuests();

  const settleQuest = useSettleQuest();
  const buildFarmQuest = useBuildFarmQuest(buildingQuantities.farms);
  const buildResourceQuest = useBuildResourceQuest(buildingQuantities.resource);
  const createTradeQuest = useCreateTradeQuest(orders);
  const createArmyQuest = useCreateArmyQuest(entityArmies, hasTroops);
  const travelQuest = useTravelQuest(hasTraveled);
  const buildWorkersHutQuest = useBuildWorkersHutQuest(buildingQuantities.workersHut);
  const marketQuest = useMarketQuest(buildingQuantities.markets);
  const pillageQuest = usePillageQuest(pillageHistoryLength);
  const mineQuest = useMineQuest(fragmentMines);
  const contributionQuest = useContributionQuest(hyperstructureContributions);
  const hyperstructureQuest = useHyperstructureQuest(hyperstructures);

  const quests = useMemo(
    () => [
      settleQuest,
      buildFarmQuest,
      buildResourceQuest,
      createTradeQuest,
      createArmyQuest,
      travelQuest,
      buildWorkersHutQuest,
      marketQuest,
      pillageQuest,
      mineQuest,
      contributionQuest,
      hyperstructureQuest,
    ],
    [
      settleQuest,
      buildFarmQuest,
      buildResourceQuest,
      createTradeQuest,
      createArmyQuest,
      travelQuest,
      buildWorkersHutQuest,
      marketQuest,
      pillageQuest,
      mineQuest,
      contributionQuest,
      hyperstructureQuest,
    ],
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

  return useMemo(
    () => ({
      buildingQuantities,
      entityArmies,
      orders,
      pillageHistoryLength,
      hasTroops,
      hasTraveled,
      fragmentMines,
      hyperstructures,
      hyperstructureContributions,
    }),
    [entityUpdate, orders],
  );
};

const useBuildQuests = () => {
  const { questClaimStatus } = useQuestClaimStatus();

  const useSettleQuest = (): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.Settle)!,
        name: QuestName.Settle,
        status: questClaimStatus[QuestName.Settle] ? QuestStatus.Claimed : QuestStatus.Completed,
      }),
      [questClaimStatus[QuestName.Settle]],
    );
  };

  const useBuildFarmQuest = (farmCount: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.BuildFarm)!,
        name: QuestName.BuildFarm,
        status:
          farmCount > 0
            ? questClaimStatus[QuestName.BuildFarm]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [farmCount, questClaimStatus[QuestName.BuildFarm]],
    );
  };

  const useBuildResourceQuest = (resourceCount: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.BuildResource)!,
        name: QuestName.BuildResource,
        status:
          resourceCount > 0
            ? questClaimStatus[QuestName.BuildResource]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [resourceCount, questClaimStatus[QuestName.BuildResource]],
    );
  };

  const useCreateTradeQuest = (orders: any[]): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.CreateTrade)!,
        name: QuestName.CreateTrade,
        status:
          orders.length > 0
            ? questClaimStatus[QuestName.CreateTrade]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [orders, questClaimStatus[QuestName.CreateTrade]],
    );
  };

  const useCreateArmyQuest = (entityArmies: ArmyInfo[], hasTroops: boolean): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.CreateArmy)!,
        name: QuestName.CreateArmy,
        status:
          entityArmies.length > 0 && hasTroops
            ? questClaimStatus[QuestName.CreateArmy]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [entityArmies, hasTroops, questClaimStatus[QuestName.CreateArmy]],
    );
  };

  const useTravelQuest = (hasTraveled: boolean): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.Travel)!,
        name: QuestName.Travel,
        status: hasTraveled
          ? questClaimStatus[QuestName.Travel]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      }),
      [hasTraveled, questClaimStatus[QuestName.Travel]],
    );
  };

  const useBuildWorkersHutQuest = (workersHutCount: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.BuildWorkersHut)!,
        name: QuestName.BuildWorkersHut,
        status:
          workersHutCount > 0
            ? questClaimStatus[QuestName.BuildWorkersHut]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [workersHutCount, questClaimStatus[QuestName.BuildWorkersHut]],
    );
  };

  const useMarketQuest = (marketsCount: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.Market)!,
        name: QuestName.Market,
        status:
          marketsCount > 0
            ? questClaimStatus[QuestName.Market]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [marketsCount, questClaimStatus[QuestName.Market]],
    );
  };

  const usePillageQuest = (pillageHistoryLength: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.Pillage)!,
        name: QuestName.Pillage,
        status:
          pillageHistoryLength > 0
            ? questClaimStatus[QuestName.Pillage]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [pillageHistoryLength, questClaimStatus[QuestName.Pillage]],
    );
  };

  const useMineQuest = (fragmentMines: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.Mine)!,
        name: QuestName.Mine,
        status:
          fragmentMines > 0
            ? questClaimStatus[QuestName.Mine]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [fragmentMines, questClaimStatus[QuestName.Mine]],
    );
  };

  const useContributionQuest = (hyperstructureContributions: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.Contribution)!,
        name: QuestName.Contribution,
        status:
          hyperstructureContributions > 0
            ? questClaimStatus[QuestName.Contribution]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [hyperstructureContributions, questClaimStatus[QuestName.Contribution]],
    );
  };

  const useHyperstructureQuest = (hyperstructures: number): Quest => {
    return useMemo(
      () => ({
        ...questDetails.get(QuestName.Hyperstructure)!,
        name: QuestName.Hyperstructure,
        status:
          hyperstructures > 0
            ? questClaimStatus[QuestName.Hyperstructure]
              ? QuestStatus.Claimed
              : QuestStatus.Completed
            : QuestStatus.InProgress,
      }),
      [hyperstructures, questClaimStatus[QuestName.Hyperstructure]],
    );
  };

  return {
    useSettleQuest,
    useBuildFarmQuest,
    useBuildResourceQuest,
    useCreateTradeQuest,
    useCreateArmyQuest,
    useTravelQuest,
    useBuildWorkersHutQuest,
    useMarketQuest,
    usePillageQuest,
    useMineQuest,
    useContributionQuest,
    useHyperstructureQuest,
  };
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
      {} as Record<QuestName, boolean>,
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
    return entityArmies[0].x != realmPosition.x || entityArmies[0].y != realmPosition.y;
  }
  return false;
};
