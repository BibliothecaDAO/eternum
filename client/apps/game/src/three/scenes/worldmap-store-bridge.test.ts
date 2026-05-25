import { describe, expect, it, vi } from "vitest";

import {
  disposeWorldmapStoreBridge,
  registerWorldmapStoreBridge,
  syncWorldmapStoreBridgeState,
  type WorldmapStoreApi,
  type WorldmapStoreState,
} from "./worldmap-store-bridge";

type RegisteredListener<TSlice> = {
  listener: (nextSlice: TSlice, previousSlice: TSlice) => void;
  selector: (state: WorldmapStoreState) => TSlice;
  unsubscribe: ReturnType<typeof vi.fn>;
};

const createWorldmapStoreState = (overrides: Partial<WorldmapStoreState> = {}): WorldmapStoreState =>
  ({
    selectableArmies: [],
    playerStructures: [],
    publicIncomingTroopArrivalsByStructure: {},
    entityActions: {
      actionPaths: new Map(),
      hoveredHex: null,
      selectedEntityId: null,
    },
    selectedHex: null,
    ...overrides,
  }) as WorldmapStoreState;

function createWorldmapStoreApi(initialState: WorldmapStoreState): {
  listeners: RegisteredListener<unknown>[];
  setState: (state: WorldmapStoreState) => void;
  store: WorldmapStoreApi;
} {
  const listeners: RegisteredListener<unknown>[] = [];
  let currentState = initialState;

  return {
    listeners,
    setState: (state) => {
      currentState = state;
    },
    store: {
      getState: () => currentState,
      subscribe: ((selector, listener) => {
        const subscription = {
          selector,
          listener,
          unsubscribe: vi.fn(),
        };
        listeners.push(subscription as RegisteredListener<unknown>);
        return subscription.unsubscribe;
      }) as WorldmapStoreApi["subscribe"],
    },
  };
}

describe("worldmap store bridge", () => {
  it("registers each worldmap-facing store slice once", () => {
    const { listeners, store } = createWorldmapStoreApi(createWorldmapStoreState());
    const callbacks = {
      onSelectableArmiesChanged: vi.fn(),
      onPlayerStructuresChanged: vi.fn(),
      onIncomingTroopArrivalsChanged: vi.fn(),
      onEntityActionsChanged: vi.fn(),
      onSelectedHexChanged: vi.fn(),
      onMapZoomPolicyChanged: vi.fn(),
    };

    const subscriptions = registerWorldmapStoreBridge({
      store,
      ...callbacks,
    });

    expect(subscriptions).toHaveLength(6);
    expect(listeners).toHaveLength(6);

    listeners[0].listener([{ entityId: 7 }] as never, [] as never);
    listeners[1].listener([{ entityId: 11 }] as never, [] as never);
    listeners[2].listener({ 99: [] } as never, {} as never);
    listeners[3].listener({ selectedEntityId: 42 } as never, { selectedEntityId: null } as never);
    listeners[4].listener({ col: 1, row: 2 } as never, null as never);
    listeners[5].listener(true as never, false as never);

    expect(callbacks.onSelectableArmiesChanged).toHaveBeenCalledWith([{ entityId: 7 }], []);
    expect(callbacks.onPlayerStructuresChanged).toHaveBeenCalledWith([{ entityId: 11 }], []);
    expect(callbacks.onIncomingTroopArrivalsChanged).toHaveBeenCalledWith({ 99: [] }, {});
    expect(callbacks.onEntityActionsChanged).toHaveBeenCalledWith({ selectedEntityId: 42 }, { selectedEntityId: null });
    expect(callbacks.onSelectedHexChanged).toHaveBeenCalledWith({ col: 1, row: 2 }, null);
    expect(callbacks.onMapZoomPolicyChanged).toHaveBeenCalledTimes(1);
  });

  it("continues disposing subscriptions after one unsubscribe throws", () => {
    const expectedError = new Error("unsubscribe failed");
    const secondUnsubscribe = vi.fn();
    const onDisposeError = vi.fn();

    disposeWorldmapStoreBridge({
      subscriptions: [
        () => {
          throw expectedError;
        },
        secondUnsubscribe,
      ],
      onDisposeError,
    });

    expect(onDisposeError).toHaveBeenCalledWith(expectedError);
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("skips store sync when the scene does not own interaction state", () => {
    const { store } = createWorldmapStoreApi(createWorldmapStoreState());
    const onSkippedWithoutOwnership = vi.fn();
    const onSelectableArmiesChanged = vi.fn();

    syncWorldmapStoreBridgeState({
      store,
      isInteractionOwner: false,
      onSkippedWithoutOwnership,
      onSelectableArmiesChanged,
      onPlayerStructuresChanged: vi.fn(),
      onIncomingTroopArrivalsChanged: vi.fn(),
      onEntityActionStateSynced: vi.fn(),
      hasMissingActionPathOwnership: () => false,
      clearEntitySelection: vi.fn(),
      onSelectedHexChanged: vi.fn(),
      onMapZoomPolicyChanged: vi.fn(),
      onSynced: vi.fn(),
    });

    expect(onSkippedWithoutOwnership).toHaveBeenCalledTimes(1);
    expect(onSelectableArmiesChanged).not.toHaveBeenCalled();
  });

  it("stops sync after clearing selection for missing action-path ownership", () => {
    const state = createWorldmapStoreState({
      selectedHex: { col: 9, row: 4 } as never,
      entityActions: {
        actionPaths: new Map(),
        hoveredHex: null,
        selectedEntityId: 17,
      } as never,
    });
    const { store } = createWorldmapStoreApi(state);
    const clearEntitySelection = vi.fn();
    const onSelectedHexChanged = vi.fn();
    const onMapZoomPolicyChanged = vi.fn();
    const onSynced = vi.fn();

    syncWorldmapStoreBridgeState({
      store,
      isInteractionOwner: true,
      onSkippedWithoutOwnership: vi.fn(),
      onSelectableArmiesChanged: vi.fn(),
      onPlayerStructuresChanged: vi.fn(),
      onIncomingTroopArrivalsChanged: vi.fn(),
      onEntityActionStateSynced: vi.fn(),
      hasMissingActionPathOwnership: () => true,
      clearEntitySelection,
      onSelectedHexChanged,
      onMapZoomPolicyChanged,
      onSynced,
    });

    expect(clearEntitySelection).toHaveBeenCalledTimes(1);
    expect(onSelectedHexChanged).not.toHaveBeenCalled();
    expect(onMapZoomPolicyChanged).not.toHaveBeenCalled();
    expect(onSynced).not.toHaveBeenCalled();
  });

  it("replays store state into the scene and clears selection when nothing is selected", () => {
    const state = createWorldmapStoreState({
      selectableArmies: [{ entityId: 1 }] as never,
      playerStructures: [{ entityId: 2 }] as never,
      publicIncomingTroopArrivalsByStructure: { 3: [{ count: 4 }] } as never,
      entityActions: {
        actionPaths: new Map([["1,1", { action: "move" }]]),
        hoveredHex: { col: 1, row: 1 },
        selectedEntityId: null,
      } as never,
      selectedHex: { col: 5, row: 6 } as never,
    });
    const { store } = createWorldmapStoreApi(state);
    const callbacks = {
      onSelectableArmiesChanged: vi.fn(),
      onPlayerStructuresChanged: vi.fn(),
      onIncomingTroopArrivalsChanged: vi.fn(),
      onEntityActionStateSynced: vi.fn(),
      clearEntitySelection: vi.fn(),
      onSelectedHexChanged: vi.fn(),
      onMapZoomPolicyChanged: vi.fn(),
      onSynced: vi.fn(),
    };

    syncWorldmapStoreBridgeState({
      store,
      isInteractionOwner: true,
      onSkippedWithoutOwnership: vi.fn(),
      hasMissingActionPathOwnership: () => false,
      ...callbacks,
    });

    expect(callbacks.onSelectableArmiesChanged).toHaveBeenCalledWith([{ entityId: 1 }]);
    expect(callbacks.onPlayerStructuresChanged).toHaveBeenCalledWith([{ entityId: 2 }]);
    expect(callbacks.onIncomingTroopArrivalsChanged).toHaveBeenCalledWith({ 3: [{ count: 4 }] });
    expect(callbacks.onEntityActionStateSynced).toHaveBeenCalledWith(state.entityActions);
    expect(callbacks.onSelectedHexChanged).toHaveBeenCalledWith({ col: 5, row: 6 });
    expect(callbacks.onMapZoomPolicyChanged).toHaveBeenCalledTimes(1);
    expect(callbacks.onSynced).toHaveBeenCalledWith(state);
    expect(callbacks.clearEntitySelection).toHaveBeenCalledTimes(1);
  });
});
