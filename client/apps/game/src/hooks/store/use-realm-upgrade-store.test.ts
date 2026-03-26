import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealmUpgradeStore } from "./use-realm-upgrade-store";

describe("useRealmUpgradeStore", () => {
  beforeEach(() => {
    useRealmUpgradeStore.setState({ upgradesByRealm: {} });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks and updates a realm upgrade entry", () => {
    useRealmUpgradeStore.getState().startUpgrade(101, 3);

    const startedUpgrade = useRealmUpgradeStore.getState().getUpgrade(101);
    expect(startedUpgrade).toEqual({
      expectedLevel: 3,
      status: "submitting",
      startedAt: Date.now(),
    });

    useRealmUpgradeStore.getState().setUpgradeStatus(101, "syncing");

    expect(useRealmUpgradeStore.getState().getUpgrade(101)).toEqual({
      expectedLevel: 3,
      status: "syncing",
      startedAt: Date.now(),
    });
  });

  it("keeps realm entries isolated by structure id", () => {
    useRealmUpgradeStore.getState().startUpgrade(101, 2);
    vi.advanceTimersByTime(1_000);
    useRealmUpgradeStore.getState().startUpgrade(202, 4);

    useRealmUpgradeStore.getState().clearUpgrade(101);

    expect(useRealmUpgradeStore.getState().getUpgrade(101)).toBeNull();
    expect(useRealmUpgradeStore.getState().getUpgrade(202)).toEqual({
      expectedLevel: 4,
      status: "submitting",
      startedAt: Date.now(),
    });
  });

  it("clears a timed-out upgrade once synced data catches up", () => {
    useRealmUpgradeStore.getState().startUpgrade(77, 5);
    useRealmUpgradeStore.getState().setUpgradeStatus(77, "syncTimeout");

    expect(useRealmUpgradeStore.getState().getUpgrade(77)?.status).toBe("syncTimeout");

    useRealmUpgradeStore.getState().clearUpgrade(77);

    expect(useRealmUpgradeStore.getState().getUpgrade(77)).toBeNull();
  });
});
