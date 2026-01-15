import { useCallback, useState } from "react";
import { useLootChestOpeningStore } from "@/hooks/store/use-loot-chest-opening-store";
import { MOCK_CHEST_OPENING, simulatePendingDelay } from "./mock-data";

// State machine states for the chest opening flow
export type ChestOpeningState = "idle" | "selecting" | "pending" | "opening" | "reveal" | "done";

// Chest epoch types for video selection
export type ChestEpoch = "eternum-rewards-s1" | "blitz-rewards-s0";

export interface ChestOpeningFlowState {
  state: ChestOpeningState;
  selectedChestId: string | null;
  selectedChestEpoch: ChestEpoch;
  error: Error | null;
}

interface UseChestOpeningFlowReturn {
  flowState: ChestOpeningFlowState;
  actions: {
    openSelection: () => void;
    selectChest: (chestId: string, epoch: ChestEpoch) => void;
    startPending: () => void;
    startOpening: () => void;
    startReveal: () => void;
    complete: () => void;
    cancel: () => void;
    reset: () => void;
    setError: (error: Error) => void;
  };
}

const initialState: ChestOpeningFlowState = {
  state: "idle",
  selectedChestId: null,
  selectedChestEpoch: "eternum-rewards-s1",
  error: null,
};

export function useChestOpeningFlow(): UseChestOpeningFlowReturn {
  const [flowState, setFlowState] = useState<ChestOpeningFlowState>(initialState);

  const { setOpenedChestTokenId, setChestOpenTimestamp, clearLootChestOpening } = useLootChestOpeningStore();

  // Transition to selection modal
  const openSelection = useCallback(() => {
    setFlowState((prev: ChestOpeningFlowState) => ({
      ...prev,
      state: "selecting",
      error: null,
    }));
  }, []);

  // Select a chest and prepare for opening
  const selectChest = useCallback(
    (chestId: string, epoch: ChestEpoch) => {
      setFlowState((prev: ChestOpeningFlowState) => ({
        ...prev,
        selectedChestId: chestId,
        selectedChestEpoch: epoch,
        error: null,
      }));

      // Update the store with the selected chest
      setOpenedChestTokenId(chestId);
    },
    [setOpenedChestTokenId],
  );

  // Transition to pending state (waiting for blockchain)
  const startPending = useCallback(() => {
    setFlowState((prev: ChestOpeningFlowState) => ({
      ...prev,
      state: "pending",
    }));

    // Set timestamp for event query
    setChestOpenTimestamp(Math.floor(Date.now() / 1000));

    // In mock mode, simulate delay then transition to opening
    if (MOCK_CHEST_OPENING) {
      simulatePendingDelay().then(() => {
        setFlowState((prev: ChestOpeningFlowState) => ({
          ...prev,
          state: "opening",
        }));
      });
    }
  }, [setChestOpenTimestamp]);

  // Transition to opening state (video playing)
  const startOpening = useCallback(() => {
    setFlowState((prev: ChestOpeningFlowState) => ({
      ...prev,
      state: "opening",
    }));
  }, []);

  // Transition to reveal state (showing cards)
  const startReveal = useCallback(() => {
    setFlowState((prev: ChestOpeningFlowState) => ({
      ...prev,
      state: "reveal",
    }));
  }, []);

  // Complete the flow
  const complete = useCallback(() => {
    setFlowState((prev: ChestOpeningFlowState) => ({
      ...prev,
      state: "done",
    }));
  }, []);

  // Cancel and return to idle
  const cancel = useCallback(() => {
    setFlowState(initialState);
    clearLootChestOpening();
  }, [clearLootChestOpening]);

  // Reset for opening another chest (keeps selection modal open)
  const reset = useCallback(() => {
    setFlowState(() => ({
      ...initialState,
      state: "selecting",
    }));
  }, []);

  // Set error state
  const setError = useCallback(
    (error: Error) => {
      setFlowState((prev: ChestOpeningFlowState) => ({
        ...prev,
        state: "idle",
        error,
      }));
      clearLootChestOpening();
    },
    [clearLootChestOpening],
  );

  return {
    flowState,
    actions: {
      openSelection,
      selectChest,
      startPending,
      startOpening,
      startReveal,
      complete,
      cancel,
      reset,
      setError,
    },
  };
}
