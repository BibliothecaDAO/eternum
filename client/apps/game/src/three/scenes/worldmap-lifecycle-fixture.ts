import { resolveUrlChangedListenerLifecycle } from "./worldmap-lifecycle-policy";

interface ListenerBinding {
  event: string;
  handler: () => void;
}

interface WorldmapLifecycleFixture {
  listenerAdds: ListenerBinding[];
  listenerRemoves: ListenerBinding[];
  followCameraTimeoutActive: boolean;
  followStateWrites: Array<{ isFollowingArmy: boolean; message: string | null }>;
  switchOffCalls: number;
  refreshRequests: number;
  setup: () => void;
  focusCameraOnEvent: (message: string) => void;
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
  let followCameraTimeout: ReturnType<typeof setTimeout> | null = null;
  let switchOffCalls = 0;
  let refreshRequests = 0;
  const followStateWrites: Array<{ isFollowingArmy: boolean; message: string | null }> = [];

  const clearFollowCameraTimeout = (resetFollowState = false) => {
    if (followCameraTimeout) {
      clearTimeout(followCameraTimeout);
      followCameraTimeout = null;
    }

    if (resetFollowState) {
      followStateWrites.push({ isFollowingArmy: false, message: null });
    }
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
    get followCameraTimeoutActive() {
      return followCameraTimeout !== null;
    },
    followStateWrites,
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
    focusCameraOnEvent(message: string) {
      followStateWrites.push({ isFollowingArmy: true, message });
      clearFollowCameraTimeout();
      followCameraTimeout = setTimeout(() => {
        followStateWrites.push({ isFollowingArmy: false, message: null });
        followCameraTimeout = null;
      }, 3000);
    },
    switchOff() {
      switchOffCalls += 1;
      isSwitchedOff = true;
      clearFollowCameraTimeout(true);
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
