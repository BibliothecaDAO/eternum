import { useDojo } from "@/hooks/context/dojo-context";
import useUIStore from "@/hooks/store/use-ui-store";
import { questDetails } from "@/ui/components/quest/quest-details";
import { ContractAddress, QuestType } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { QUEST_DETAILS } from "../../constants";
import { Prize } from "../../types";

export enum QuestStatus {
  InProgress,
  Completed,
  Claimed,
}

export const useQuests = () => {
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
      ...questDetails.get(type)!,
      ...QUEST_DETAILS[type],
    }));
  }, []);

  return quests;
};

const useQuestClaimStatus = () => {
  const {
    setup: {
      components: { Quest, Owner },
    },
    account: { account },
  } = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const realmOwner = useComponentValue(Owner, getEntityIdFromKeys([BigInt(structureEntityId)]))?.address;
  const isNotOwner = realmOwner !== ContractAddress(account.address);

  const prizeUpdate = useEntityQuery([HasValue(Quest, { entity_id: structureEntityId || 0 })]);

  const questClaimStatus = useMemo(() => {
    const entityBigInt = BigInt(structureEntityId || 0);

    const checkPrizesClaimed = (prizes: ReadonlyArray<Prize>) =>
      prizes.every(
        (prize) => getComponentValue(Quest, getEntityIdFromKeys([entityBigInt, BigInt(prize.id)]))?.completed,
      );

    return Array.from(questDetails.keys()).reduce(
      (acc, questName) => ({
        ...acc,
        [questName]: isNotOwner || checkPrizesClaimed(questDetails.get(questName)?.prizes || []),
      }),
      {} as Record<QuestType, boolean>,
    );
  }, [structureEntityId, isNotOwner, prizeUpdate, Quest]);

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
