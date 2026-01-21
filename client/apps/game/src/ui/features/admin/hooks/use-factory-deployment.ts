import { useReducer, useCallback, useMemo, useEffect } from "react";
import type {
  GamePresetType,
  DeploymentState,
  TxState,
  WorldStatus,
  FactoryUIState,
  WorldConfigOverride,
} from "../types/game-presets";
import { generateWorldName } from "../utils/world-name";
import {
  getStoredWorldNames,
  getCurrentWorldName,
  setCurrentWorldName,
  saveWorldNameToStorage,
  persistStoredWorldNames,
  getStoredWorldSeriesMetadata,
  updateWorldSeriesMetadata,
  type WorldSeriesMetadata,
  getStoredWorldConfigOverrides,
  updateWorldConfigOverride as updateWorldConfigOverrideStorage,
} from "../utils/storage";

// ============================================================================
// State Types
// ============================================================================

export interface FactoryState {
  // Deployment wizard state
  deployment: DeploymentState;

  // Transaction states (consolidated)
  txState: {
    deploy: TxState;
    config: TxState;
    series: TxState;
  };

  // World management
  worldQueue: string[];
  worldStatuses: Record<string, WorldStatus>;
  worldSeriesMetadata: Record<string, WorldSeriesMetadata>;

  // Per-world config overrides (for the queue)
  worldConfigOverrides: Record<string, WorldConfigOverride>;

  // UI state
  ui: FactoryUIState;
}

// ============================================================================
// Actions
// ============================================================================

type FactoryAction =
  | { type: "SELECT_PRESET"; preset: GamePresetType }
  | { type: "GO_BACK" }
  | { type: "UPDATE_DEPLOYMENT"; updates: Partial<DeploymentState> }
  | { type: "SET_TX_STATE"; txType: keyof FactoryState["txState"]; state: TxState }
  | { type: "ADD_TO_QUEUE"; worldName: string; metadata?: WorldSeriesMetadata; configOverrides?: WorldConfigOverride }
  | { type: "REMOVE_FROM_QUEUE"; worldName: string }
  | { type: "UPDATE_WORLD_STATUS"; worldName: string; status: Partial<WorldStatus> }
  | { type: "SET_WORLD_STATUSES"; statuses: Record<string, WorldStatus> }
  | { type: "UPDATE_WORLD_CONFIG_OVERRIDE"; worldName: string; overrides: Partial<WorldConfigOverride> }
  | { type: "TOGGLE_UI"; key: keyof FactoryUIState }
  | { type: "SET_EXPANDED_WORLD_CONFIG"; worldName: string | null }
  | {
      type: "LOAD_FROM_STORAGE";
      worldQueue: string[];
      worldSeriesMetadata: Record<string, WorldSeriesMetadata>;
      worldConfigOverrides: Record<string, WorldConfigOverride>;
    }
  | { type: "RESET_DEPLOYMENT" }
  | { type: "REGENERATE_WORLD_NAME" };

// ============================================================================
// Initial State
// ============================================================================

const createInitialState = (): FactoryState => ({
  deployment: {
    step: "select-preset",
    selectedPreset: null,
    gameName: generateWorldName(),
    startTime: 0,
    seriesName: "",
    seriesGameNumber: "",
    customOverrides: {},
  },
  txState: {
    deploy: { status: "idle" },
    config: { status: "idle" },
    series: { status: "idle" },
  },
  worldQueue: [],
  worldStatuses: {},
  worldSeriesMetadata: {},
  worldConfigOverrides: {},
  ui: {
    showAdvanced: false,
    showDevSection: false,
    showCairoOutput: false,
    showFullConfig: false,
    expandedWorldConfig: null,
  },
});

// ============================================================================
// Reducer
// ============================================================================

function factoryReducer(state: FactoryState, action: FactoryAction): FactoryState {
  switch (action.type) {
    case "SELECT_PRESET":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          step: "review-deploy",
          selectedPreset: action.preset,
        },
      };

    case "GO_BACK":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          step: "select-preset",
        },
      };

    case "UPDATE_DEPLOYMENT":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          ...action.updates,
        },
      };

    case "SET_TX_STATE":
      return {
        ...state,
        txState: {
          ...state.txState,
          [action.txType]: action.state,
        },
      };

    case "ADD_TO_QUEUE": {
      const alreadyExists = state.worldQueue.includes(action.worldName);
      const newQueue = alreadyExists ? state.worldQueue : [...state.worldQueue, action.worldName];
      const newMetadata = action.metadata
        ? { ...state.worldSeriesMetadata, [action.worldName]: action.metadata }
        : state.worldSeriesMetadata;
      const newOverrides = action.configOverrides
        ? { ...state.worldConfigOverrides, [action.worldName]: action.configOverrides }
        : state.worldConfigOverrides;

      return {
        ...state,
        worldQueue: newQueue,
        worldSeriesMetadata: newMetadata,
        worldConfigOverrides: newOverrides,
        // Generate new name for next addition
        deployment: {
          ...state.deployment,
          gameName: alreadyExists ? state.deployment.gameName : generateWorldName(),
          seriesName: "",
          seriesGameNumber: "",
        },
      };
    }

    case "REMOVE_FROM_QUEUE": {
      const newQueue = state.worldQueue.filter((name) => name !== action.worldName);
      const { [action.worldName]: _removed, ...newStatuses } = state.worldStatuses;
      const { [action.worldName]: _removedMeta, ...newMetadata } = state.worldSeriesMetadata;
      const { [action.worldName]: _removedOverrides, ...newOverrides } = state.worldConfigOverrides;

      return {
        ...state,
        worldQueue: newQueue,
        worldStatuses: newStatuses,
        worldSeriesMetadata: newMetadata,
        worldConfigOverrides: newOverrides,
      };
    }

    case "UPDATE_WORLD_STATUS":
      return {
        ...state,
        worldStatuses: {
          ...state.worldStatuses,
          [action.worldName]: {
            ...(state.worldStatuses[action.worldName] || {
              deployed: false,
              configured: false,
              indexerExists: false,
              verifying: false,
            }),
            ...action.status,
          },
        },
      };

    case "SET_WORLD_STATUSES":
      return {
        ...state,
        worldStatuses: {
          ...state.worldStatuses,
          ...action.statuses,
        },
      };

    case "UPDATE_WORLD_CONFIG_OVERRIDE":
      return {
        ...state,
        worldConfigOverrides: {
          ...state.worldConfigOverrides,
          [action.worldName]: {
            ...(state.worldConfigOverrides[action.worldName] || {}),
            ...action.overrides,
          },
        },
      };

    case "TOGGLE_UI":
      return {
        ...state,
        ui: {
          ...state.ui,
          [action.key]: !state.ui[action.key],
        },
      };

    case "SET_EXPANDED_WORLD_CONFIG":
      return {
        ...state,
        ui: {
          ...state.ui,
          expandedWorldConfig: action.worldName,
        },
      };

    case "LOAD_FROM_STORAGE":
      return {
        ...state,
        worldQueue: action.worldQueue,
        worldSeriesMetadata: action.worldSeriesMetadata,
        worldConfigOverrides: action.worldConfigOverrides,
      };

    case "RESET_DEPLOYMENT":
      return {
        ...state,
        deployment: {
          step: "select-preset",
          selectedPreset: null,
          gameName: generateWorldName(),
          startTime: 0,
          seriesName: "",
          seriesGameNumber: "",
          customOverrides: {},
        },
        txState: {
          deploy: { status: "idle" },
          config: { status: "idle" },
          series: { status: "idle" },
        },
      };

    case "REGENERATE_WORLD_NAME":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          gameName: generateWorldName(),
        },
      };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export const useFactoryDeployment = () => {
  const [state, dispatch] = useReducer(factoryReducer, undefined, createInitialState);

  // Load from storage on mount
  useEffect(() => {
    const storedQueue = getStoredWorldNames();
    const storedMetadata = getStoredWorldSeriesMetadata();
    const currentName = getCurrentWorldName();

    dispatch({
      type: "LOAD_FROM_STORAGE",
      worldQueue: storedQueue,
      worldSeriesMetadata: storedMetadata,
      worldConfigOverrides: getStoredWorldConfigOverrides(),
    });

    if (currentName) {
      dispatch({
        type: "UPDATE_DEPLOYMENT",
        updates: { gameName: currentName },
      });
    }
  }, []);

  // ============================================================================
  // Action Creators
  // ============================================================================

  const selectPreset = useCallback((preset: GamePresetType) => {
    dispatch({ type: "SELECT_PRESET", preset });
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: "GO_BACK" });
  }, []);

  const updateDeployment = useCallback((updates: Partial<DeploymentState>) => {
    dispatch({ type: "UPDATE_DEPLOYMENT", updates });

    // Sync game name to storage
    if (updates.gameName !== undefined) {
      setCurrentWorldName(updates.gameName);
    }
  }, []);

  const setTxState = useCallback((txType: keyof FactoryState["txState"], txState: TxState) => {
    dispatch({ type: "SET_TX_STATE", txType, state: txState });
  }, []);

  const addToQueue = useCallback(
    (worldName: string, metadata?: WorldSeriesMetadata, configOverrides?: WorldConfigOverride) => {
      // Persist to storage
      saveWorldNameToStorage(worldName);
      if (metadata) {
        updateWorldSeriesMetadata(worldName, metadata);
      }
      if (configOverrides) {
        updateWorldConfigOverrideStorage(worldName, configOverrides);
      }

      dispatch({ type: "ADD_TO_QUEUE", worldName, metadata, configOverrides });
    },
    [],
  );

  const removeFromQueue = useCallback((worldName: string) => {
    // Remove from storage
    const existing = getStoredWorldNames();
    const updated = existing.filter((name) => name !== worldName);
    persistStoredWorldNames(updated);
    updateWorldSeriesMetadata(worldName, null);
    updateWorldConfigOverrideStorage(worldName, null);

    dispatch({ type: "REMOVE_FROM_QUEUE", worldName });
  }, []);

  const updateWorldStatus = useCallback((worldName: string, status: Partial<WorldStatus>) => {
    dispatch({ type: "UPDATE_WORLD_STATUS", worldName, status });
  }, []);

  const setWorldStatuses = useCallback((statuses: Record<string, WorldStatus>) => {
    dispatch({ type: "SET_WORLD_STATUSES", statuses });
  }, []);

  const updateWorldConfigOverride = useCallback((worldName: string, overrides: Partial<WorldConfigOverride>) => {
    dispatch({ type: "UPDATE_WORLD_CONFIG_OVERRIDE", worldName, overrides });
    updateWorldConfigOverrideStorage(worldName, overrides);
  }, []);

  const toggleUI = useCallback((key: keyof FactoryUIState) => {
    dispatch({ type: "TOGGLE_UI", key });
  }, []);

  const setExpandedWorldConfig = useCallback((worldName: string | null) => {
    dispatch({ type: "SET_EXPANDED_WORLD_CONFIG", worldName });
  }, []);

  const resetDeployment = useCallback(() => {
    dispatch({ type: "RESET_DEPLOYMENT" });
  }, []);

  const regenerateWorldName = useCallback(() => {
    const newName = generateWorldName();
    setCurrentWorldName(newName);
    dispatch({ type: "REGENERATE_WORLD_NAME" });
  }, []);

  // ============================================================================
  // Memoized Values
  // ============================================================================

  const actions = useMemo(
    () => ({
      selectPreset,
      goBack,
      updateDeployment,
      setTxState,
      addToQueue,
      removeFromQueue,
      updateWorldStatus,
      setWorldStatuses,
      updateWorldConfigOverride,
      toggleUI,
      setExpandedWorldConfig,
      resetDeployment,
      regenerateWorldName,
    }),
    [
      selectPreset,
      goBack,
      updateDeployment,
      setTxState,
      addToQueue,
      removeFromQueue,
      updateWorldStatus,
      setWorldStatuses,
      updateWorldConfigOverride,
      toggleUI,
      setExpandedWorldConfig,
      resetDeployment,
      regenerateWorldName,
    ],
  );

  return {
    state,
    actions,
  };
};
