// @vitest-environment node
import { ResourcesIds } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Freeze block time so nextRunAt math is deterministic across tests.
const FROZEN_BLOCK_SECONDS = 1_700_000_000;

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getSeasonConfig: () => ({
      startSettlingAt: 10,
      startMainAt: 20,
      endAt: 30,
    }),
  },
  getBlockTimestamp: () => ({ currentBlockTimestamp: FROZEN_BLOCK_SECONDS }),
}));

import { useTransferAutomationStore } from "./use-transfer-automation-store";

const FROZEN_NOW_MS = FROZEN_BLOCK_SECONDS * 1000;
const FROZEN_GAME_ID = "10-20-30";

const resetStore = () => {
  useTransferAutomationStore.setState({ entries: {} });
};

describe("useTransferAutomationStore", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe("add", () => {
    it("creates an active entry with scheduled nextRunAt and season-based gameId", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood, ResourcesIds.Coal],
        intervalMinutes: 5,
      });
      const entry = useTransferAutomationStore.getState().entries[id];
      expect(entry.active).toBe(true);
      expect(entry.sourceEntityId).toBe("1");
      expect(entry.destinationEntityId).toBe("2");
      expect(entry.gameId).toBe(FROZEN_GAME_ID);
      expect(entry.intervalMinutes).toBe(5);
      expect(entry.createdAt).toBe(FROZEN_NOW_MS);
      expect(entry.nextRunAt).toBe(FROZEN_NOW_MS + 5 * 60_000);
    });

    it("nextRunAt is null when created inactive", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
        active: false,
      });
      expect(useTransferAutomationStore.getState().entries[id].nextRunAt).toBeNull();
      expect(useTransferAutomationStore.getState().entries[id].active).toBe(false);
    });

    it("dedupes resourceIds and filters non-numeric entries", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [
          ResourcesIds.Wood,
          ResourcesIds.Wood,
          "not-a-number" as unknown as ResourcesIds,
          ResourcesIds.Coal,
        ],
        intervalMinutes: 5,
      });
      expect(useTransferAutomationStore.getState().entries[id].resourceIds).toEqual([
        ResourcesIds.Wood,
        ResourcesIds.Coal,
      ]);
    });

    it("builds resourceConfigs from resourceIds with zero amount when none provided", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood, ResourcesIds.Coal],
        intervalMinutes: 1,
      });
      const configs = useTransferAutomationStore.getState().entries[id].resourceConfigs;
      expect(configs).toEqual([
        { resourceId: ResourcesIds.Wood, amount: 0 },
        { resourceId: ResourcesIds.Coal, amount: 0 },
      ]);
    });

    it("sanitizes provided resourceConfigs: drops bogus entries and floors negatives", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 1,
        resourceConfigs: [
          { resourceId: ResourcesIds.Wood, amount: 100 },
          { resourceId: "junk" as unknown as ResourcesIds, amount: 10 },
          { resourceId: ResourcesIds.Coal, amount: -5 },
          { resourceId: ResourcesIds.Stone, amount: 7.9 },
        ],
      });
      expect(useTransferAutomationStore.getState().entries[id].resourceConfigs).toEqual([
        { resourceId: ResourcesIds.Wood, amount: 100 },
        { resourceId: ResourcesIds.Coal, amount: 0 },
        { resourceId: ResourcesIds.Stone, amount: 7 },
      ]);
    });

    it("clamps intervalMinutes below 1 to 1", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 0,
      });
      expect(useTransferAutomationStore.getState().entries[id].intervalMinutes).toBe(1);
      expect(useTransferAutomationStore.getState().entries[id].nextRunAt).toBe(FROZEN_NOW_MS + 60_000);
    });

    it("rounds a fractional intervalMinutes", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5.4,
      });
      expect(useTransferAutomationStore.getState().entries[id].intervalMinutes).toBe(5);
    });

    it("generates a unique id per entry", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        ids.add(
          useTransferAutomationStore.getState().add({
            sourceEntityId: "1",
            destinationEntityId: "2",
            resourceIds: [ResourcesIds.Wood],
            intervalMinutes: 5,
          }),
        );
      }
      expect(ids.size).toBe(10);
    });
  });

  describe("update", () => {
    it("patches metadata and re-sanitizes resourceConfigs", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      useTransferAutomationStore.getState().update(id, {
        sourceName: "Alpha",
        destinationName: "Beta",
        resourceConfigs: [{ resourceId: ResourcesIds.Wood, amount: 42 }],
      });
      const entry = useTransferAutomationStore.getState().entries[id];
      expect(entry.sourceName).toBe("Alpha");
      expect(entry.destinationName).toBe("Beta");
      expect(entry.resourceConfigs).toEqual([{ resourceId: ResourcesIds.Wood, amount: 42 }]);
    });

    it("clamps a fractional intervalMinutes when updating", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      useTransferAutomationStore.getState().update(id, { intervalMinutes: 7.6 });
      expect(useTransferAutomationStore.getState().entries[id].intervalMinutes).toBe(8);
    });

    it("clamps intervalMinutes below 1 when updating", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      useTransferAutomationStore.getState().update(id, { intervalMinutes: 0 });
      expect(useTransferAutomationStore.getState().entries[id].intervalMinutes).toBe(1);
    });

    it("leaves existing resourceConfigs untouched when patch omits it", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
        resourceConfigs: [{ resourceId: ResourcesIds.Wood, amount: 10 }],
      });
      useTransferAutomationStore.getState().update(id, { sourceName: "Alpha" });
      expect(useTransferAutomationStore.getState().entries[id].resourceConfigs).toEqual([
        { resourceId: ResourcesIds.Wood, amount: 10 },
      ]);
    });

    it("no-ops when the entry does not exist", () => {
      useTransferAutomationStore.getState().update("nope", { sourceName: "x" });
      expect(useTransferAutomationStore.getState().entries["nope"]).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("drops the entry but leaves others intact", () => {
      const id1 = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      const id2 = useTransferAutomationStore.getState().add({
        sourceEntityId: "3",
        destinationEntityId: "4",
        resourceIds: [ResourcesIds.Coal],
        intervalMinutes: 5,
      });
      useTransferAutomationStore.getState().remove(id1);
      expect(useTransferAutomationStore.getState().entries[id1]).toBeUndefined();
      expect(useTransferAutomationStore.getState().entries[id2]).toBeDefined();
    });

    it("no-ops when removing a missing id", () => {
      useTransferAutomationStore.getState().remove("nope");
      expect(useTransferAutomationStore.getState().entries).toEqual({});
    });
  });

  describe("toggleActive", () => {
    it("pauses an active entry and nulls nextRunAt", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      useTransferAutomationStore.getState().toggleActive(id);
      const entry = useTransferAutomationStore.getState().entries[id];
      expect(entry.active).toBe(false);
      expect(entry.nextRunAt).toBeNull();
    });

    it("resumes an inactive entry and reschedules from now", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 7,
        active: false,
      });
      useTransferAutomationStore.getState().toggleActive(id, true);
      const entry = useTransferAutomationStore.getState().entries[id];
      expect(entry.active).toBe(true);
      expect(entry.nextRunAt).toBe(FROZEN_NOW_MS + 7 * 60_000);
    });

    it("respects explicit active=false when already paused", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
        active: false,
      });
      useTransferAutomationStore.getState().toggleActive(id, false);
      expect(useTransferAutomationStore.getState().entries[id].active).toBe(false);
      expect(useTransferAutomationStore.getState().entries[id].nextRunAt).toBeNull();
    });

    it("no-ops when the entry does not exist", () => {
      useTransferAutomationStore.getState().toggleActive("nope");
      expect(useTransferAutomationStore.getState().entries["nope"]).toBeUndefined();
    });
  });

  describe("scheduleNext", () => {
    it("uses the current block time when no base is provided", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 3,
      });
      useTransferAutomationStore.getState().scheduleNext(id);
      expect(useTransferAutomationStore.getState().entries[id].nextRunAt).toBe(FROZEN_NOW_MS + 3 * 60_000);
    });

    it("honours an explicit base timestamp", () => {
      const id = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      useTransferAutomationStore.getState().scheduleNext(id, 9_000_000);
      expect(useTransferAutomationStore.getState().entries[id].nextRunAt).toBe(9_000_000 + 5 * 60_000);
    });

    it("no-ops for a missing entry", () => {
      useTransferAutomationStore.getState().scheduleNext("nope");
      expect(useTransferAutomationStore.getState().entries["nope"]).toBeUndefined();
    });
  });

  describe("clearAll / pruneForGame", () => {
    it("clearAll empties all entries", () => {
      useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      useTransferAutomationStore.getState().clearAll();
      expect(useTransferAutomationStore.getState().entries).toEqual({});
    });

    it("pruneForGame drops entries from other gameIds", () => {
      const keptId = useTransferAutomationStore.getState().add({
        sourceEntityId: "1",
        destinationEntityId: "2",
        resourceIds: [ResourcesIds.Wood],
        intervalMinutes: 5,
      });
      const staleId = useTransferAutomationStore.getState().add({
        sourceEntityId: "3",
        destinationEntityId: "4",
        resourceIds: [ResourcesIds.Coal],
        intervalMinutes: 5,
        gameId: "some-old-game",
      });
      useTransferAutomationStore.getState().pruneForGame(FROZEN_GAME_ID);
      expect(useTransferAutomationStore.getState().entries[keptId]).toBeDefined();
      expect(useTransferAutomationStore.getState().entries[staleId]).toBeUndefined();
    });
  });
});
