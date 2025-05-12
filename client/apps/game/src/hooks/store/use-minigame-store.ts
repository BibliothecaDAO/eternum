import { GameData, GameScore, GameSettingsMetadata } from "metagame-sdk";
import { create } from "zustand";

type MinigameStore = {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  minigames: GameData[] | undefined;
  setMinigames: (minigames: GameData[] | undefined) => void;
  settingsMetadata: Record<string, GameSettingsMetadata[]> | undefined;
  setSettingsMetadata: (settingsMetadata: Record<string, GameSettingsMetadata[]>) => void;
  scores: undefined | Record<string, GameScore>;
  setScores: (scores: Record<string, GameScore>) => void;
  updateScore: (score: GameScore) => void;
};

export const useMinigameStore = create<MinigameStore>((set) => ({
  loading: false,
  setLoading: (loading: boolean) => set({ loading }),
  minigames: undefined,
  setMinigames: (minigames: GameData[] | undefined) => set({ minigames }),
  settingsMetadata: undefined,
  setSettingsMetadata: (settingsMetadata: Record<string, GameSettingsMetadata[]>) => set({ settingsMetadata }),
  scores: {},
  setScores: (scores: Record<string, GameScore>) => set({ scores }),
  updateScore: (score: GameScore) =>
    set((state) => ({
      scores: {
        ...state.scores,
        [score.token_id]: score,
      },
    })),
}));
