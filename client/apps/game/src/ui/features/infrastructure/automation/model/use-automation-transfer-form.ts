import { useCallback, useReducer } from "react";

import { AutomationOrder, OrderMode, ProductionType, TransferMode } from "@/hooks/store/use-automation-store";
import { ResourcesIds } from "@bibliothecadao/types";

import { isTransferAllowed } from "../lib/transfer-utils";
import type { SelectedEntity, SelectedResource } from "../lib/transfer-types";

interface UseAutomationTransferFormOptions {
  source: SelectedEntity | null;
  destination: SelectedEntity | null;
}

interface AutomationTransferFormState {
  transferMode: TransferMode;
  transferInterval: number;
  transferThreshold: number;
  resources: SelectedResource[];
  newResourceId: ResourcesIds | "";
  newResourceAmount: number;
  error: string | null;
}

type AutomationTransferFormAction =
  | { type: "SET_MODE"; payload: TransferMode }
  | { type: "SET_INTERVAL"; payload: number }
  | { type: "SET_THRESHOLD"; payload: number }
  | { type: "SET_NEW_RESOURCE_ID"; payload: ResourcesIds | "" }
  | { type: "SET_NEW_RESOURCE_AMOUNT"; payload: number }
  | { type: "ADD_RESOURCE"; payload: SelectedResource }
  | { type: "REMOVE_RESOURCE"; payload: ResourcesIds }
  | { type: "RESET" }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

const INITIAL_STATE: AutomationTransferFormState = {
  transferMode: TransferMode.Recurring,
  transferInterval: 60,
  transferThreshold: 1000,
  resources: [],
  newResourceId: "",
  newResourceAmount: 100,
  error: null,
};

const automationTransferReducer = (
  state: AutomationTransferFormState,
  action: AutomationTransferFormAction,
): AutomationTransferFormState => {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        transferMode: action.payload,
        error: null,
      };
    case "SET_INTERVAL":
      return {
        ...state,
        transferInterval: action.payload,
        error: null,
      };
    case "SET_THRESHOLD":
      return {
        ...state,
        transferThreshold: action.payload,
        error: null,
      };
    case "SET_NEW_RESOURCE_ID":
      return {
        ...state,
        newResourceId: action.payload,
        error: null,
      };
    case "SET_NEW_RESOURCE_AMOUNT":
      return {
        ...state,
        newResourceAmount: action.payload,
        error: null,
      };
    case "ADD_RESOURCE":
      return {
        ...state,
        resources: [...state.resources, action.payload],
        newResourceId: "",
        newResourceAmount: 100,
        error: null,
      };
    case "REMOVE_RESOURCE":
      return {
        ...state,
        resources: state.resources.filter((resource) => resource.resourceId !== action.payload),
        error: null,
      };
    case "RESET":
      return INITIAL_STATE;
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

interface SubmitSuccess {
  success: true;
  order: Omit<AutomationOrder, "id" | "producedAmount" | "createdAt">;
}

interface SubmitFailure {
  success: false;
  error: string;
}

export type AutomationTransferSubmitResult = SubmitSuccess | SubmitFailure;

export const useAutomationTransferForm = ({ source, destination }: UseAutomationTransferFormOptions) => {
  const [state, dispatch] = useReducer(automationTransferReducer, INITIAL_STATE);

  const setTransferMode = useCallback((mode: TransferMode) => {
    dispatch({ type: "SET_MODE", payload: mode });
  }, []);

  const setTransferInterval = useCallback((interval: number) => {
    dispatch({ type: "SET_INTERVAL", payload: Math.max(1, interval) });
  }, []);

  const setTransferThreshold = useCallback((threshold: number) => {
    dispatch({ type: "SET_THRESHOLD", payload: Math.max(1, threshold) });
  }, []);

  const setNewResourceId = useCallback((resourceId: ResourcesIds | "") => {
    dispatch({ type: "SET_NEW_RESOURCE_ID", payload: resourceId });
  }, []);

  const setNewResourceAmount = useCallback((amount: number) => {
    dispatch({ type: "SET_NEW_RESOURCE_AMOUNT", payload: Math.max(1, amount) });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const addResource = useCallback(
    (resourceId: ResourcesIds, amount: number): SubmitFailure | { success: true } => {
      if (!source || !destination) {
        const error = "Select source and destination before adding resources.";
        dispatch({ type: "SET_ERROR", payload: error });
        return { success: false, error };
      }

      if (state.resources.some((resource) => resource.resourceId === resourceId)) {
        const error = "This resource is already added to the transfer.";
        dispatch({ type: "SET_ERROR", payload: error });
        return { success: false, error };
      }

      if (!isTransferAllowed(source.category, destination.category, resourceId)) {
        const resourceName = ResourcesIds[resourceId];
        const error = `The resource ${resourceName} cannot be transferred between these structure types.`;
        dispatch({ type: "SET_ERROR", payload: error });
        return {
          success: false,
          error,
        };
      }

      dispatch({ type: "ADD_RESOURCE", payload: { resourceId, amount } });
      dispatch({ type: "CLEAR_ERROR" });
      return { success: true };
    },
    [destination, source, state.resources],
  );

  const removeResource = useCallback((resourceId: ResourcesIds) => {
    dispatch({ type: "REMOVE_RESOURCE", payload: resourceId });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const submit = useCallback((): AutomationTransferSubmitResult => {
    if (!source || !destination) {
      const error = "Please select source and destination entities.";
      dispatch({ type: "SET_ERROR", payload: error });
      return { success: false, error };
    }

    if (state.resources.length === 0) {
      const error = "Add at least one resource to transfer.";
      dispatch({ type: "SET_ERROR", payload: error });
      return { success: false, error };
    }

    const invalidResources = state.resources.filter(
      (resource) => !isTransferAllowed(source.category, destination.category, resource.resourceId),
    );

    if (invalidResources.length > 0) {
      const resourceNames = invalidResources.map((resource) => ResourcesIds[resource.resourceId]).join(", ");
      const error = `The following resources cannot be transferred between these structure types: ${resourceNames}`;
      dispatch({ type: "SET_ERROR", payload: error });
      return { success: false, error };
    }

    const order: Omit<AutomationOrder, "id" | "producedAmount" | "createdAt"> = {
      priority: 5,
      resourceToUse: state.resources[0].resourceId,
      mode: OrderMode.ProduceOnce,
      maxAmount: 0,
      realmEntityId: source.entityId.toString(),
      productionType: ProductionType.Transfer,
      realmName: source.name,
      targetEntityId: destination.entityId.toString(),
      targetEntityName: destination.name,
      transferMode: state.transferMode,
      transferInterval: state.transferMode === TransferMode.Recurring ? state.transferInterval : undefined,
      transferThreshold: state.transferMode !== TransferMode.Recurring ? state.transferThreshold : undefined,
      transferResources: state.resources,
    };

    dispatch({ type: "CLEAR_ERROR" });

    return {
      success: true,
      order,
    };
  }, [destination, source, state]);

  return {
    state,
    setTransferMode,
    setTransferInterval,
    setTransferThreshold,
    setNewResourceId,
    setNewResourceAmount,
    addResource,
    removeResource,
    submit,
    reset,
    clearError,
  };
};
