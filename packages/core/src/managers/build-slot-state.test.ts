// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  BUILD_SLOT_TRANSITION_STALE_MS,
  markBuildPending,
  markDestroyPending,
  markOccupiedUnconfirmed,
  resolveOccupiedState,
} from "./build-slot-state";

describe("build-slot-state", () => {
  it("keeps build-pending slots occupied until synced occupancy confirms", () => {
    const transitions = new Map();
    const key = "1,2,3,4";

    markBuildPending(transitions, key, 1000);

    expect(resolveOccupiedState(transitions, key, false, { now: 2000 })).toBe(true);
    expect(transitions.get(key)?.status).toBe("build_pending");

    expect(resolveOccupiedState(transitions, key, true, { now: 2000 })).toBe(true);
    expect(transitions.has(key)).toBe(false);
  });

  it("keeps destroy-pending slots occupied until synced vacancy confirms", () => {
    const transitions = new Map();
    const key = "5,6,7,8";

    markDestroyPending(transitions, key, 1000);

    expect(resolveOccupiedState(transitions, key, true, { now: 2000 })).toBe(true);
    expect(transitions.get(key)?.status).toBe("destroy_pending");

    expect(resolveOccupiedState(transitions, key, false, { now: 2000 })).toBe(false);
    expect(transitions.has(key)).toBe(false);
  });

  it("holds occupied-unconfirmed slots until sync confirms or the hold goes stale", () => {
    const transitions = new Map();
    const key = "9,9,9,9";

    markOccupiedUnconfirmed(transitions, key, 1000);

    expect(resolveOccupiedState(transitions, key, false, { now: 2000 })).toBe(true);
    expect(transitions.get(key)?.status).toBe("occupied_unconfirmed");

    expect(resolveOccupiedState(transitions, key, true, { now: 2000 })).toBe(true);
    expect(transitions.has(key)).toBe(false);

    markOccupiedUnconfirmed(transitions, key, 1000);
    expect(resolveOccupiedState(transitions, key, false, { now: 1000 + BUILD_SLOT_TRANSITION_STALE_MS + 1 })).toBe(
      false,
    );
    expect(transitions.has(key)).toBe(false);
  });
});
