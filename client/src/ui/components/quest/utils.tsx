import { Quest, QuestStatus } from "@/hooks/helpers/useQuests";

export const groupQuestsByDepth = (quests: Quest[]): Record<number, Quest[]> => {
  return quests?.reduce((groupedQuests: Record<number, Quest[]>, quest) => {
    const depth = quest.depth;
    if (!groupedQuests[depth]) {
      groupedQuests[depth] = [];
    }
    groupedQuests[depth].push(quest);
    return groupedQuests;
  }, {});
};

export const areAllQuestsClaimed = (quests: Quest[]) => quests.every((quest) => quest.status === QuestStatus.Claimed);
