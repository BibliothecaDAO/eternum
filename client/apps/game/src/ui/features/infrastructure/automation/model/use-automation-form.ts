import { useCallback, useEffect, useReducer } from "react";
import {
  AutomationOrder,
  OrderMode,
  ProductionType,
  TransferMode,
} from "@/hooks/store/use-automation-store";
import { ResourcesIds } from "@bibliothecadao/types";

export interface ResourceOption {
  id: ResourcesIds;
  name: string;
}

interface UseAutomationFormOptions {
  realmEntityId: string;
  realmName: string;
  resourceOptions: ResourceOption[];
}

interface AutomationOrderDraft
  extends Omit<AutomationOrder, "id" | "producedAmount" | "realmEntityId" | "resourceToUse"> {
  resourceToUse?: ResourcesIds;
}

interface AutomationFormState {
  order: AutomationOrderDraft;
  maxAmountInput: string;
  isInfinite: boolean;
  error: string | null;
}

type AutomationFormAction =
  | { type: "SET_MODE"; payload: OrderMode }
  | { type: "SET_PRIORITY"; payload: number }
  | { type: "SET_RESOURCE"; payload?: ResourcesIds }
  | { type: "SET_PRODUCTION_TYPE"; payload: { productionType: ProductionType; fallbackResource?: ResourcesIds } }
  | { type: "SET_MAX_AMOUNT_INPUT"; payload: string }
  | { type: "SET_INFINITE"; payload: boolean }
  | { type: "SET_BUFFER"; payload: number }
  | { type: "SET_TRANSFER_META"; payload: Partial<AutomationOrderDraft> }
  | { type: "RESET"; payload: AutomationFormState }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

const MIN_PRIORITY = 1;
const MAX_PRIORITY = 9;
const MIN_TARGET_FOR_PRODUCE_ONCE = 1000;

const createInitialState = ({ realmName, resourceOptions }: UseAutomationFormOptions): AutomationFormState => {
  const defaultResource = resourceOptions[0]?.id;

  return {
    order: {
      priority: 5,
      resourceToUse: defaultResource,
      mode: OrderMode.ProduceOnce,
      maxAmount: 1000,
      productionType: ProductionType.ResourceToResource,
      realmName,
      bufferPercentage: 10,
      transferMode: TransferMode.Recurring,
      transferInterval: 60,
      transferResources: [],
    },
    maxAmountInput: "1000",
    isInfinite: false,
    error: null,
  };
};

const automationFormReducer = (state: AutomationFormState, action: AutomationFormAction): AutomationFormState => {
  switch (action.type) {
    case "SET_MODE": {
      if (action.payload === OrderMode.ProduceOnce) {
        return {
          ...state,
          order: {
            ...state.order,
            mode: action.payload,
            maxAmount: state.isInfinite ? "infinite" : state.order.maxAmount,
          },
          error: null,
        };
      }

      const fallbackValue = parseInt(state.maxAmountInput, 10);
      const sanitizedValue = Number.isNaN(fallbackValue) || fallbackValue < 0 ? 0 : fallbackValue;

      return {
        ...state,
        order: {
          ...state.order,
          mode: action.payload,
          maxAmount: sanitizedValue,
        },
        isInfinite: false,
        error: null,
      };
    }
    case "SET_PRIORITY": {
      const priority = Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, action.payload));
      return {
        ...state,
        order: {
          ...state.order,
          priority,
        },
        error: null,
      };
    }
    case "SET_RESOURCE":
      return {
        ...state,
        order: {
          ...state.order,
          resourceToUse: action.payload,
        },
        error: null,
      };
    case "SET_PRODUCTION_TYPE": {
      return {
        ...state,
        order: {
          ...state.order,
          productionType: action.payload.productionType,
          resourceToUse: action.payload.fallbackResource,
        },
        error: null,
        isInfinite: action.payload.productionType === ProductionType.Transfer ? false : state.isInfinite,
      };
    }
    case "SET_MAX_AMOUNT_INPUT": {
      const numericValue = parseInt(action.payload, 10);
      const sanitizedValue = Number.isNaN(numericValue) ? 0 : numericValue;

      return {
        ...state,
        maxAmountInput: action.payload,
        order: {
          ...state.order,
          maxAmount: state.isInfinite ? "infinite" : sanitizedValue,
        },
        error: null,
      };
    }
    case "SET_INFINITE": {
      if (action.payload) {
        return {
          ...state,
          isInfinite: true,
          order: {
            ...state.order,
            maxAmount: "infinite",
          },
          error: null,
        };
      }

      const fallbackValue = parseInt(state.maxAmountInput, 10);
      const sanitizedValue = Number.isNaN(fallbackValue) || fallbackValue < 0 ? 0 : fallbackValue;

      return {
        ...state,
        isInfinite: false,
        order: {
          ...state.order,
          maxAmount: sanitizedValue,
        },
        error: null,
      };
    }
    case "SET_BUFFER": {
      const clamped = Math.max(0, Math.min(50, action.payload));
      return {
        ...state,
        order: {
          ...state.order,
          bufferPercentage: clamped,
        },
        error: null,
      };
    }
    case "SET_TRANSFER_META":
      return {
        ...state,
        order: {
          ...state.order,
          ...action.payload,
        },
        error: null,
      };
    case "RESET":
      return action.payload;
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
  order: Omit<AutomationOrder, "id" | "producedAmount">;
}

interface SubmitFailure {
  success: false;
  error: string;
}

export type AutomationFormSubmitResult = SubmitSuccess | SubmitFailure;

export const useAutomationForm = (options: UseAutomationFormOptions) => {
  const { realmEntityId, realmName, resourceOptions } = options;

  const [state, dispatch] = useReducer(automationFormReducer, undefined, () =>
    createInitialState({ realmEntityId, realmName, resourceOptions }),
  );

  useEffect(() => {
    dispatch({ type: "RESET", payload: createInitialState({ realmEntityId, realmName, resourceOptions }) });
  }, [realmEntityId, realmName, resourceOptions]);

  const setMode = useCallback((mode: OrderMode) => {
    dispatch({ type: "SET_MODE", payload: mode });
  }, []);

  const setPriority = useCallback((priority: number) => {
    dispatch({ type: "SET_PRIORITY", payload: priority });
  }, []);

  const setResource = useCallback((resourceId?: ResourcesIds) => {
    dispatch({ type: "SET_RESOURCE", payload: resourceId });
  }, []);

  const setProductionType = useCallback(
    (productionType: ProductionType) => {
      dispatch({
        type: "SET_PRODUCTION_TYPE",
        payload: {
          productionType,
          fallbackResource: resourceOptions[0]?.id,
        },
      });
    },
    [resourceOptions],
  );

  const setMaxAmountInput = useCallback((value: string) => {
    dispatch({ type: "SET_MAX_AMOUNT_INPUT", payload: value });
  }, []);

  const toggleInfinite = useCallback(() => {
    dispatch({ type: "SET_INFINITE", payload: !state.isInfinite });
  }, [state.isInfinite]);

  const setBufferPercentage = useCallback((value: number) => {
    dispatch({ type: "SET_BUFFER", payload: value });
  }, []);

  const submit = useCallback((): AutomationFormSubmitResult => {
    if (!state.order.resourceToUse) {
      const error = "Please select a valid resource to produce for this realm.";
      dispatch({ type: "SET_ERROR", payload: error });
      return { success: false, error };
    }

    if (
      typeof state.order.maxAmount === "number" &&
      state.order.maxAmount <= 0
    ) {
      const error = "Target amount must be greater than 0.";
      dispatch({ type: "SET_ERROR", payload: error });
      return { success: false, error };
    }

    if (
      state.order.mode === OrderMode.ProduceOnce &&
      !state.isInfinite &&
      typeof state.order.maxAmount === "number" &&
      state.order.maxAmount < MIN_TARGET_FOR_PRODUCE_ONCE
    ) {
      const error = `Target amount must be at least ${MIN_TARGET_FOR_PRODUCE_ONCE}, or set to infinite.`;
      dispatch({ type: "SET_ERROR", payload: error });
      return { success: false, error };
    }

    if (
      state.order.productionType === ProductionType.ResourceToResource &&
      state.order.resourceToUse === ResourcesIds.Labor
    ) {
      const error = "Please select a labor resource.";
      dispatch({ type: "SET_ERROR", payload: error });
      return { success: false, error };
    }

    const maxAmount = state.isInfinite ? "infinite" : state.order.maxAmount;

    const order: Omit<AutomationOrder, "id" | "producedAmount"> = {
      ...state.order,
      resourceToUse: state.order.resourceToUse!,
      realmEntityId,
      maxAmount,
    };

    dispatch({ type: "CLEAR_ERROR" });

    return {
      success: true,
      order,
    };
  }, [state, realmEntityId]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET", payload: createInitialState({ realmEntityId, realmName, resourceOptions }) });
  }, [realmEntityId, realmName, resourceOptions]);

  return {
    state,
    setMode,
    setPriority,
    setResource,
    setProductionType,
    setMaxAmountInput,
    toggleInfinite,
    setBufferPercentage,
    submit,
    reset,
  };
};
