import { create } from "zustand";
import { Quest } from "../helpers/useQuests";

interface QuestStore {
  selectedQuest: Quest | null;
  setSelectedQuest: (selectedQuest: Quest | null) => void;
  showCompletedQuests: boolean;
  setShowCompletedQuests: (showCompletedQuests: boolean) => void;
}

export const useQuestStore = create<QuestStore>((set) => ({
  selectedQuest: null,
  setSelectedQuest: (selectedQuest: Quest | null) => set({ selectedQuest }),
  showCompletedQuests: false,
  setShowCompletedQuests: (showCompletedQuests: boolean) => set({ showCompletedQuests }),
}));
