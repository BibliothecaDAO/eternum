import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  incomingTroopArrivalsView,
  playerStructuresView,
  readFactView,
  selectableArmiesView,
  watchFactView,
} from "@/sync/fact-views";
import type { Structure } from "@bibliothecadao/types";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

export type WorldmapStoreState = ReturnType<typeof useUIStore.getState>;

type SelectableArmies = ReturnType<typeof selectableArmiesView.read>;
type IncomingTroopArrivals = ReturnType<typeof incomingTroopArrivalsView.read>;

type WorldmapSliceListener<TSlice> = (nextSlice: TSlice, previousSlice: TSlice) => void;

interface WorldmapStoreApi {
  getState: () => WorldmapStoreState;
  subscribe: <TSlice>(
    selector: (state: WorldmapStoreState) => TSlice,
    listener: WorldmapSliceListener<TSlice>,
  ) => () => void;
}

interface RegisterWorldmapStoreBridgeInput {
  store?: WorldmapStoreApi;
  facts: NativeFactStore;
  onSelectableArmiesChanged: (selectableArmies: SelectableArmies) => void;
  onPlayerStructuresChanged: (playerStructures: Structure[]) => void;
  onIncomingTroopArrivalsChanged: (incomingTroopArrivalsByStructure: IncomingTroopArrivals) => void;
  onEntityActionsChanged: (
    nextEntityActions: WorldmapStoreState["entityActions"],
    previousEntityActions: WorldmapStoreState["entityActions"] | undefined,
  ) => void;
  onSelectedHexChanged: (selectedHex: WorldmapStoreState["selectedHex"]) => void;
}

interface DisposeWorldmapStoreBridgeInput {
  subscriptions: Array<() => void>;
  onDisposeError: (error: unknown) => void;
}

interface SyncWorldmapStoreBridgeStateInput {
  store?: WorldmapStoreApi;
  facts: NativeFactStore;
  isInteractionOwner: boolean;
  onSkippedWithoutOwnership: () => void;
  onSelectableArmiesChanged: (selectableArmies: SelectableArmies) => void;
  onPlayerStructuresChanged: (playerStructures: Structure[]) => void;
  onIncomingTroopArrivalsChanged: (incomingTroopArrivalsByStructure: IncomingTroopArrivals) => void;
  onEntityActionStateSynced: (entityActions: WorldmapStoreState["entityActions"]) => void;
  hasMissingActionPathOwnership: () => boolean;
  clearEntitySelection: () => void;
  onSelectedHexChanged: (selectedHex: WorldmapStoreState["selectedHex"]) => void;
  onSynced: (uiState: WorldmapStoreState) => void;
}

const defaultWorldmapStoreApi: WorldmapStoreApi = {
  getState: () => useUIStore.getState(),
  subscribe: useUIStore.subscribe as WorldmapStoreApi["subscribe"],
};

export function registerWorldmapStoreBridge({
  store = defaultWorldmapStoreApi,
  facts,
  onSelectableArmiesChanged,
  onPlayerStructuresChanged,
  onIncomingTroopArrivalsChanged,
  onEntityActionsChanged,
  onSelectedHexChanged,
}: RegisterWorldmapStoreBridgeInput): Array<() => void> {
  return [
    watchFactView(facts, selectableArmiesView, onSelectableArmiesChanged),
    watchFactView(facts, playerStructuresView, onPlayerStructuresChanged),
    watchFactView(facts, incomingTroopArrivalsView, onIncomingTroopArrivalsChanged),
    store.subscribe((state) => state.entityActions, onEntityActionsChanged),
    store.subscribe((state) => state.selectedHex, onSelectedHexChanged),
  ];
}

export function disposeWorldmapStoreBridge({ subscriptions, onDisposeError }: DisposeWorldmapStoreBridgeInput): void {
  subscriptions.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      onDisposeError(error);
    }
  });
}

export function syncWorldmapStoreBridgeState({
  store = defaultWorldmapStoreApi,
  facts,
  isInteractionOwner,
  onSkippedWithoutOwnership,
  onSelectableArmiesChanged,
  onPlayerStructuresChanged,
  onIncomingTroopArrivalsChanged,
  onEntityActionStateSynced,
  hasMissingActionPathOwnership,
  clearEntitySelection,
  onSelectedHexChanged,
  onSynced,
}: SyncWorldmapStoreBridgeStateInput): void {
  if (!isInteractionOwner) {
    onSkippedWithoutOwnership();
    return;
  }

  const uiState = store.getState();

  onSelectableArmiesChanged(readFactView(facts, selectableArmiesView));
  onPlayerStructuresChanged(readFactView(facts, playerStructuresView));
  onIncomingTroopArrivalsChanged(readFactView(facts, incomingTroopArrivalsView));
  onEntityActionStateSynced(uiState.entityActions);

  if (hasMissingActionPathOwnership()) {
    clearEntitySelection();
    return;
  }

  onSelectedHexChanged(uiState.selectedHex);
  onSynced(uiState);

  if (uiState.entityActions.selectedEntityId === null || uiState.entityActions.selectedEntityId === undefined) {
    clearEntitySelection();
  }
}
