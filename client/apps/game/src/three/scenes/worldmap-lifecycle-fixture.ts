import { resolveUrlChangedListenerLifecycle } from "./worldmap-lifecycle-policy";
import { destroyWorldmapOwnedManagers } from "./worldmap-ownership-lifecycle";

interface ListenerBinding {
  event: string;
  handler: () => void;
}

interface WorldmapLifecycleFixture {
  listenerAdds: ListenerBinding[];
  listenerRemoves: ListenerBinding[];
  destroyCalls: {
    armyManager: number;
    structureManager: number;
    chestManager: number;
    fxManager: number;
    resourceFXManager: number;
  };
  switchOffCalls: number;
  refreshRequests: number;
  setup: () => void;
  switchOff: () => void;
  destroy: () => void;
  updateVisibleChunks: () => boolean;
  requestChunkRefresh: () => void;
}

export function createWorldmapLifecycleFixture(): WorldmapLifecycleFixture {
  const listenerAdds: ListenerBinding[] = [];
  const listenerRemoves: ListenerBinding[] = [];
  const urlChangedHandler = () => {};

  let isSwitchedOff = false;
  let isUrlChangedListenerAttached = false;
  let switchOffCalls = 0;
  let refreshRequests = 0;
  const destroyCalls = {
    armyManager: 0,
    structureManager: 0,
    chestManager: 0,
    fxManager: 0,
    resourceFXManager: 0,
  };

  const syncUrlChangedListenerLifecycle = (phase: "setup" | "switchOff" | "destroy") => {
    const decision = resolveUrlChangedListenerLifecycle({
      phase,
      isUrlChangedListenerAttached,
    });

    if (decision.shouldAttach) {
      listenerAdds.push({ event: "urlChanged", handler: urlChangedHandler });
    }
    if (decision.shouldDetach) {
      listenerRemoves.push({ event: "urlChanged", handler: urlChangedHandler });
    }

    isUrlChangedListenerAttached = decision.nextIsUrlChangedListenerAttached;
  };

  return {
    listenerAdds,
    listenerRemoves,
    destroyCalls,
    get switchOffCalls() {
      return switchOffCalls;
    },
    get refreshRequests() {
      return refreshRequests;
    },
    setup() {
      isSwitchedOff = false;
      syncUrlChangedListenerLifecycle("setup");
    },
    switchOff() {
      switchOffCalls += 1;
      isSwitchedOff = true;
      syncUrlChangedListenerLifecycle("switchOff");
    },
    destroy() {
      this.switchOff();
      destroyWorldmapOwnedManagers({
        armyManager: {
          destroy: () => {
            destroyCalls.armyManager += 1;
          },
        },
        structureManager: {
          destroy: () => {
            destroyCalls.structureManager += 1;
          },
        },
        chestManager: {
          destroy: () => {
            destroyCalls.chestManager += 1;
          },
        },
        fxManager: {
          destroy: () => {
            destroyCalls.fxManager += 1;
          },
        },
        resourceFXManager: {
          destroy: () => {
            destroyCalls.resourceFXManager += 1;
          },
        },
      });
    },
    updateVisibleChunks() {
      if (isSwitchedOff) {
        return false;
      }
      return true;
    },
    requestChunkRefresh() {
      if (isSwitchedOff) {
        return;
      }
      refreshRequests += 1;
    },
  };
}
