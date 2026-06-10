// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";

// Stub localStorage so Zustand `persist` middleware doesn't throw under node env.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  key(i: number) {
    return Array.from(this.data.keys())[i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
import {
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  DONKEY_DEFAULT_RESOURCE_PERCENT,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  isAutomationResourceBlocked,
  useAutomationStore,
  type RealmAutomationConfig,
} from "./use-automation-store";

const resetStore = () => {
  useAutomationStore.setState({
    realms: {},
    nextRunTimestamp: null,
    hydrated: true,
    gameId: "test-game",
  });
};

describe("isAutomationResourceBlocked", () => {
  it("blocks Wheat and Labor as outputs", () => {
    expect(isAutomationResourceBlocked(ResourcesIds.Wheat, "realm", "output")).toBe(true);
    expect(isAutomationResourceBlocked(ResourcesIds.Labor, "realm", "output")).toBe(true);
  });

  it("never blocks a resource when role is input", () => {
    expect(isAutomationResourceBlocked(ResourcesIds.Wheat, "realm", "input")).toBe(false);
    expect(isAutomationResourceBlocked(ResourcesIds.Labor, "realm", "input")).toBe(false);
  });

  it("does not block non-blocked resources", () => {
    expect(isAutomationResourceBlocked(ResourcesIds.Knight, "realm", "output")).toBe(false);
  });
});

describe("useAutomationStore", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe("upsertRealm", () => {
    it("creates a realm with smart preset and autoBalance true by default", () => {
      useAutomationStore.getState().upsertRealm("1", { realmName: "Alpha" });
      const realm = useAutomationStore.getState().realms["1"];
      expect(realm.realmName).toBe("Alpha");
      expect(realm.presetId).toBe("smart");
      expect(realm.autoBalance).toBe(true);
      expect(realm.entityType).toBe("realm");
      expect(realm.customPercentages).toEqual({});
    });

    it("updates realm metadata without dropping percentages", () => {
      useAutomationStore.getState().upsertRealm("1", { realmName: "Alpha" });
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wood, { resourceToResource: 10 });

      useAutomationStore.getState().upsertRealm("1", { realmName: "Beta" });
      const realm = useAutomationStore.getState().realms["1"];
      expect(realm.realmName).toBe("Beta");
      expect(realm.customPercentages[ResourcesIds.Wood].resourceToResource).toBe(10);
    });

    it("normalizes unknown preset ids to smart when creating", () => {
      useAutomationStore
        .getState()
        .upsertRealm("1", { presetId: "bogus" as unknown as RealmAutomationConfig["presetId"] });
      expect(useAutomationStore.getState().realms["1"].presetId).toBe("smart");
    });
  });

  describe("setRealmPreset", () => {
    it("updates preset on an existing realm", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setRealmPreset("1", "idle");
      expect(useAutomationStore.getState().realms["1"].presetId).toBe("idle");
    });

    it("no-ops when the realm does not exist", () => {
      useAutomationStore.getState().setRealmPreset("nope", "idle");
      expect(useAutomationStore.getState().realms["nope"]).toBeUndefined();
    });

    it("normalizes a bogus preset to smart", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore
        .getState()
        .setRealmPreset("1", "something-weird" as unknown as RealmAutomationConfig["presetId"]);
      expect(useAutomationStore.getState().realms["1"].presetId).toBe("smart");
    });
  });

  describe("setResourcePercentages", () => {
    it("switches the preset to custom when percentages change", () => {
      useAutomationStore.getState().upsertRealm("1", { presetId: "smart" });
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wood, { resourceToResource: 25 });
      const realm = useAutomationStore.getState().realms["1"];
      expect(realm.presetId).toBe("custom");
      expect(realm.customPercentages[ResourcesIds.Wood]).toEqual({ resourceToResource: 25, laborToResource: 5 });
    });

    it("clamps values above MAX and floors negatives", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wood, {
        resourceToResource: 999,
        laborToResource: -50,
      });
      const realm = useAutomationStore.getState().realms["1"];
      expect(realm.customPercentages[ResourcesIds.Wood]).toEqual({
        resourceToResource: MAX_RESOURCE_ALLOCATION_PERCENT,
        laborToResource: 0,
      });
    });

    it("ignores blocked output resources", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wheat, { resourceToResource: 50 });
      expect(useAutomationStore.getState().realms["1"].customPercentages[ResourcesIds.Wheat]).toBeUndefined();
    });

    it("forces Donkey laborToResource to 0", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Donkey, {
        resourceToResource: 20,
        laborToResource: 30,
      });
      const realm = useAutomationStore.getState().realms["1"];
      expect(realm.customPercentages[ResourcesIds.Donkey]).toEqual({ resourceToResource: 20, laborToResource: 0 });
    });

    it("uses DONKEY_DEFAULT_RESOURCE_PERCENT as the default when Donkey is first set via a labor-only patch", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Donkey, { laborToResource: 0 });
      expect(useAutomationStore.getState().realms["1"].customPercentages[ResourcesIds.Donkey]).toEqual({
        resourceToResource: DONKEY_DEFAULT_RESOURCE_PERCENT,
        laborToResource: 0,
      });
    });

    it("no-ops when the new value equals the existing value", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wood, { resourceToResource: 10 });
      const firstUpdatedAt = useAutomationStore.getState().realms["1"].updatedAt;
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wood, { resourceToResource: 10 });
      // Unchanged state should not bump updatedAt.
      expect(useAutomationStore.getState().realms["1"].updatedAt).toBe(firstUpdatedAt);
    });
  });

  describe("removeRealm / resetRealm / resetAll", () => {
    it("removeRealm drops the realm", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().removeRealm("1");
      expect(useAutomationStore.getState().realms["1"]).toBeUndefined();
    });

    it("resetRealm clears custom percentages and resets preset to smart", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wood, { resourceToResource: 30 });
      useAutomationStore.getState().resetRealm("1");
      const realm = useAutomationStore.getState().realms["1"];
      expect(realm.presetId).toBe("smart");
      expect(realm.customPercentages).toEqual({});
      expect(realm.lastExecution).toBeUndefined();
      expect(realm.lastStatus).toBeUndefined();
    });

    it("resetAll empties realms and clears nextRunTimestamp", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setNextRunTimestamp(1234);
      useAutomationStore.getState().resetAll();
      const state = useAutomationStore.getState();
      expect(state.realms).toEqual({});
      expect(state.nextRunTimestamp).toBeNull();
    });
  });

  describe("recordExecution / recordStatus", () => {
    it("attaches a lastExecution summary without mutating percentages", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setResourcePercentages("1", ResourcesIds.Wood, { resourceToResource: 15 });
      useAutomationStore.getState().recordExecution("1", {
        executedAt: 111,
        resourceToResource: [],
        laborToResource: [],
        consumptionByResource: {},
        outputsByResource: {},
        skipped: [],
        skippedByResource: {},
      });
      const realm = useAutomationStore.getState().realms["1"];
      expect(realm.lastExecution?.executedAt).toBe(111);
      expect(realm.customPercentages[ResourcesIds.Wood].resourceToResource).toBe(15);
    });

    it("attaches lastStatus with its consecutiveFailures", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().recordStatus("1", {
        status: "failed",
        message: "nope",
        attemptedAt: 42,
        consecutiveFailures: 2,
      });
      expect(useAutomationStore.getState().realms["1"].lastStatus?.consecutiveFailures).toBe(2);
    });

    it("no-ops when the realm does not exist", () => {
      useAutomationStore.getState().recordExecution("nope", {
        executedAt: 1,
        resourceToResource: [],
        laborToResource: [],
        consumptionByResource: {},
        outputsByResource: {},
        skipped: [],
        skippedByResource: {},
      });
      expect(useAutomationStore.getState().realms["nope"]).toBeUndefined();
    });
  });

  describe("pruneForGame", () => {
    it("clears realms and nextRunTimestamp when gameId changes", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.getState().setNextRunTimestamp(999);
      useAutomationStore.setState({ gameId: "old-game" });
      useAutomationStore.getState().pruneForGame("new-game");
      const state = useAutomationStore.getState();
      expect(state.realms).toEqual({});
      expect(state.nextRunTimestamp).toBeNull();
      expect(state.gameId).toBe("new-game");
    });

    it("no-ops when the gameId matches", () => {
      useAutomationStore.getState().upsertRealm("1");
      useAutomationStore.setState({ gameId: "same-game" });
      useAutomationStore.getState().pruneForGame("same-game");
      expect(useAutomationStore.getState().realms["1"]).toBeDefined();
    });
  });

  describe("getRealmConfig", () => {
    it("returns the realm config when present", () => {
      useAutomationStore.getState().upsertRealm("1", { realmName: "Alpha" });
      expect(useAutomationStore.getState().getRealmConfig("1")?.realmName).toBe("Alpha");
    });

    it("returns undefined for an unknown realm", () => {
      expect(useAutomationStore.getState().getRealmConfig("nope")).toBeUndefined();
    });
  });

  describe("DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES", () => {
    it("defaults to 0 resource, 5 labor so new configs don't over-commit", () => {
      expect(DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES).toEqual({ resourceToResource: 0, laborToResource: 5 });
    });
  });
});
