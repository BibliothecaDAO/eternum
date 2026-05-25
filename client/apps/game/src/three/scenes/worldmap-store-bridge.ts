import { useUIStore } from "@/hooks/store/use-ui-store";

export type WorldmapStoreState = ReturnType<typeof useUIStore.getState>;

type WorldmapSliceListener<TSlice> = (nextSlice: TSlice, previousSlice: TSlice) => void;

export interface WorldmapStoreApi {
  getState: () => WorldmapStoreState;
  subscribe: <TSlice>(
    selector: (state: WorldmapStoreState) => TSlice,
    listener: WorldmapSliceListener<TSlice>,
  ) => () => void;
}

interface RegisterWorldmapStoreBridgeInput {
  store?: WorldmapStoreApi;
  onSelectableArmiesChanged: (selectableArmies: WorldmapStoreState["selectableArmies"]) => void;
  onPlayerStructuresChanged: (playerStructures: WorldmapStoreState["playerStructures"]) => void;
  onIncomingTroopArrivalsChanged: (
    publicIncomingTroopArrivalsByStructure: WorldmapStoreState["publicIncomingTroopArrivalsByStructure"],
  ) => void;
  onEntityActionsChanged: (
    nextEntityActions: WorldmapStoreState["entityActions"],
    previousEntityActions: WorldmapStoreState["entityActions"] | undefined,
  ) => void;
  onSelectedHexChanged: (selectedHex: WorldmapStoreState["selectedHex"]) => void;
  onMapZoomPolicyChanged: () => void;
}

interface DisposeWorldmapStoreBridgeInput {
  subscriptions: Array<() => void>;
  onDisposeError: (error: unknown) => void;
}

interface SyncWorldmapStoreBridgeStateInput {
  store?: WorldmapStoreApi;
  isInteractionOwner: boolean;
  onSkippedWithoutOwnership: () => void;
  onSelectableArmiesChanged: (selectableArmies: WorldmapStoreState["selectableArmies"]) => void;
  onPlayerStructuresChanged: (playerStructures: WorldmapStoreState["playerStructures"]) => void;
  onIncomingTroopArrivalsChanged: (
    publicIncomingTroopArrivalsByStructure: WorldmapStoreState["publicIncomingTroopArrivalsByStructure"],
  ) => void;
  onEntityActionStateSynced: (entityActions: WorldmapStoreState["entityActions"]) => void;
  hasMissingActionPathOwnership: () => boolean;
  clearEntitySelection: () => void;
  onSelectedHexChanged: (selectedHex: WorldmapStoreState["selectedHex"]) => void;
  onMapZoomPolicyChanged: () => void;
  onSynced: (uiState: WorldmapStoreState) => void;
}

const defaultWorldmapStoreApi: WorldmapStoreApi = {
  getState: () => useUIStore.getState(),
  subscribe: useUIStore.subscribe as WorldmapStoreApi["subscribe"],
};

export function registerWorldmapStoreBridge({
  store = defaultWorldmapStoreApi,
  onSelectableArmiesChanged,
  onPlayerStructuresChanged,
  onIncomingTroopArrivalsChanged,
  onEntityActionsChanged,
  onSelectedHexChanged,
  onMapZoomPolicyChanged,
}: RegisterWorldmapStoreBridgeInput): Array<() => void> {
  return [
    store.subscribe((state) => state.selectableArmies, onSelectableArmiesChanged),
    store.subscribe((state) => state.playerStructures, onPlayerStructuresChanged),
    store.subscribe((state) => state.publicIncomingTroopArrivalsByStructure, onIncomingTroopArrivalsChanged),
    store.subscribe((state) => state.entityActions, onEntityActionsChanged),
    store.subscribe((state) => state.selectedHex, onSelectedHexChanged),
    store.subscribe(
      (state) => state.enableMapZoom,
      () => {
        onMapZoomPolicyChanged();
      },
    ),
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
  isInteractionOwner,
  onSkippedWithoutOwnership,
  onSelectableArmiesChanged,
  onPlayerStructuresChanged,
  onIncomingTroopArrivalsChanged,
  onEntityActionStateSynced,
  hasMissingActionPathOwnership,
  clearEntitySelection,
  onSelectedHexChanged,
  onMapZoomPolicyChanged,
  onSynced,
}: SyncWorldmapStoreBridgeStateInput): void {
  if (!isInteractionOwner) {
    onSkippedWithoutOwnership();
    return;
  }

  const uiState = store.getState();

  onSelectableArmiesChanged(uiState.selectableArmies);
  onPlayerStructuresChanged(uiState.playerStructures);
  onIncomingTroopArrivalsChanged(uiState.publicIncomingTroopArrivalsByStructure);
  onEntityActionStateSynced(uiState.entityActions);

  if (hasMissingActionPathOwnership()) {
    clearEntitySelection();
    return;
  }

  onSelectedHexChanged(uiState.selectedHex);
  onMapZoomPolicyChanged();
  onSynced(uiState);

  if (uiState.entityActions.selectedEntityId === null || uiState.entityActions.selectedEntityId === undefined) {
    clearEntitySelection();
  }
}
