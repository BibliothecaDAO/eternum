import { resolveUrlChangedListenerLifecycle } from "./worldmap-lifecycle-policy";

interface ListenerBinding {
  event: string;
  handler: () => void;
}

interface WorldmapLifecycleFixture {
  listenerAdds: ListenerBinding[];
  listenerRemoves: ListenerBinding[];
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
