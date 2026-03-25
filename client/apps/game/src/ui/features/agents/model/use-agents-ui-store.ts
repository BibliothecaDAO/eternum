import type { SteeringJobType } from "@bibliothecadao/types";
import { create } from "zustand";

type DockTab = "activity" | "chat" | "steering" | "details";

interface AgentsUiState {
  selectedWorldId: string | null;
  setSelectedWorldId: (worldId: string | null) => void;
  selectedAgentIdByWorld: Record<string, string>;
  setSelectedAgentForWorld: (worldId: string, agentId: string) => void;
  isDockOpen: boolean;
  setDockOpen: (isOpen: boolean) => void;
  dockTab: DockTab;
  setDockTab: (tab: DockTab) => void;
  draftMessageByAgentId: Record<string, string>;
  setDraftMessage: (agentId: string, value: string) => void;
  draftSteeringJobByAgentId: Record<string, SteeringJobType>;
  setDraftSteeringJob: (agentId: string, job: SteeringJobType) => void;
}

export const useAgentsUiStore = create<AgentsUiState>((set) => ({
  selectedWorldId: null,
  setSelectedWorldId: (selectedWorldId) => set({ selectedWorldId }),
  selectedAgentIdByWorld: {},
  setSelectedAgentForWorld: (worldId, agentId) =>
    set((state) => ({
      selectedAgentIdByWorld: {
        ...state.selectedAgentIdByWorld,
        [worldId]: agentId,
      },
    })),
  isDockOpen: false,
  setDockOpen: (isDockOpen) => set({ isDockOpen }),
  dockTab: "activity",
  setDockTab: (dockTab) => set({ dockTab }),
  draftMessageByAgentId: {},
  setDraftMessage: (agentId, value) =>
    set((state) => ({
      draftMessageByAgentId: {
        ...state.draftMessageByAgentId,
        [agentId]: value,
      },
    })),
  draftSteeringJobByAgentId: {},
  setDraftSteeringJob: (agentId, job) =>
    set((state) => ({
      draftSteeringJobByAgentId: {
        ...state.draftSteeringJobByAgentId,
        [agentId]: job,
      },
    })),
}));
