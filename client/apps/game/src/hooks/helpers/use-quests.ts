import { useUIStore } from "@/hooks/store/use-ui-store";
import { Prize, QuestStatus, QuestType } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { QUEST_DETAILS } from "./use-starting-tutorial";

export const useQuests = () => {
  const questStatus = useQuestClaimStatus();

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
      status: questStatus.questClaimStatus[type] ? QuestStatus.Claimed : QuestStatus.InProgress,
    }));
  }, [questStatus]);

  return quests;
};

const useQuestClaimStatus = () => {
  const {
    setup: {
      components: { Quest },
    },
  } = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  // todo: find another way to know if settler
  const isNotSettler = false;

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
