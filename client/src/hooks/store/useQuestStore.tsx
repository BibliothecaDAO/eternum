import { create } from "zustand";
import { Quest } from "../helpers/useQuests";

export interface QuestStore {
  selectedQuest: Quest | null;
  setSelectedQuest: (selectedQuest: Quest | null) => void;
}

export const useQuestStore = create<QuestStore>((set) => ({
  selectedQuest: null,
  setSelectedQuest: (selectedQuest: Quest | null) => set({ selectedQuest }),
}));
