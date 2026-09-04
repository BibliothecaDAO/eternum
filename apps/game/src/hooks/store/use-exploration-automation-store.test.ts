// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getSeasonConfig: () => ({ startSettlingAt: 1, startMainAt: 2, endAt: 3 }),
  },
}));

import {
  DEFAULT_SCOPE_RADIUS,
  DEFAULT_STRATEGY_ID,
  EXPLORATION_AUTOMATION_INTERVAL_MS,
  useExplorationAutomationStore,
} from "./use-exploration-automation-store";

const FROZEN_NOW = 1_700_000_000_000;
const FROZEN_GAME_ID = "1-2-3";

beforeAll(() => {
  vi.spyOn(Date, "now").mockReturnValue(FROZEN_NOW);
});

const resetStore = () => {
  useExplorationAutomationStore.setState({ entries: {} });
};

describe("useExplorationAutomationStore", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe("add", () => {
    it("creates an active entry with default strategy and scheduled nextRunAt", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "42",
        active: true,
        scopeRadius: 10,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      const entry = useExplorationAutomationStore.getState().entries[id];
      expect(entry.active).toBe(true);
      expect(entry.explorerId).toBe("42");
      expect(entry.gameId).toBe(FROZEN_GAME_ID);
      expect(entry.scopeRadius).toBe(10);
      expect(entry.strategyId).toBe(DEFAULT_STRATEGY_ID);
      expect(entry.createdAt).toBe(FROZEN_NOW);
      expect(entry.nextRunAt).toBe(FROZEN_NOW + EXPLORATION_AUTOMATION_INTERVAL_MS);
    });

    it("defaults active to true when omitted", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "42",
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      } as Parameters<ReturnType<typeof useExplorationAutomationStore.getState>["add"]>[0]);
      expect(useExplorationAutomationStore.getState().entries[id].active).toBe(true);
    });

    it("leaves nextRunAt null when created inactive", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "42",
        active: false,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      expect(useExplorationAutomationStore.getState().entries[id].nextRunAt).toBeNull();
    });

    it("normalizes scopeRadius: rounds and enforces min of 1", () => {
      const tiny = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: 0,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      expect(useExplorationAutomationStore.getState().entries[tiny].scopeRadius).toBe(1);

      const fractional = useExplorationAutomationStore.getState().add({
        explorerId: "2",
        active: true,
        scopeRadius: 7.6,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      expect(useExplorationAutomationStore.getState().entries[fractional].scopeRadius).toBe(8);
    });

    it("falls back to DEFAULT_SCOPE_RADIUS when scopeRadius is not finite", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: Number.NaN,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      expect(useExplorationAutomationStore.getState().entries[id].scopeRadius).toBe(DEFAULT_SCOPE_RADIUS);
    });

    it("generates a unique id per entry", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        ids.add(
          useExplorationAutomationStore.getState().add({
            explorerId: String(i),
            active: true,
            scopeRadius: DEFAULT_SCOPE_RADIUS,
            strategyId: DEFAULT_STRATEGY_ID,
          }),
        );
      }
      expect(ids.size).toBe(10);
    });
  });

  describe("update", () => {
    const seed = () =>
      useExplorationAutomationStore.getState().add({
        explorerId: "42",
        active: true,
        scopeRadius: 10,
        strategyId: DEFAULT_STRATEGY_ID,
      });

    it("patches scopeRadius and re-normalizes it", () => {
      const id = seed();
      useExplorationAutomationStore.getState().update(id, { scopeRadius: 0.2 });
      expect(useExplorationAutomationStore.getState().entries[id].scopeRadius).toBe(1);
    });

    it("patches strategyId without touching other fields", () => {
      const id = seed();
      useExplorationAutomationStore
        .getState()
        .update(id, { strategyId: "custom-strategy" as unknown as typeof DEFAULT_STRATEGY_ID });
      const entry = useExplorationAutomationStore.getState().entries[id];
      expect(entry.strategyId).toBe("custom-strategy");
      expect(entry.explorerId).toBe("42");
    });

    it("normalizes nextRunAt through the timestamp helper", () => {
      const id = seed();
      useExplorationAutomationStore.getState().update(id, { nextRunAt: "not-a-number" as unknown as number });
      // Invalid input falls back to prev nextRunAt, which was the scheduled timestamp.
      expect(useExplorationAutomationStore.getState().entries[id].nextRunAt).toBe(
        FROZEN_NOW + EXPLORATION_AUTOMATION_INTERVAL_MS,
      );
    });

    it("treats a null nextRunAt patch as 'no change' (nullish-coalesce falls through to prev)", () => {
      const id = seed();
      const prev = useExplorationAutomationStore.getState().entries[id].nextRunAt;
      useExplorationAutomationStore.getState().update(id, { nextRunAt: null });
      // Callers that need to clear nextRunAt must use toggleActive(id, false) instead.
      expect(useExplorationAutomationStore.getState().entries[id].nextRunAt).toBe(prev);
    });

    it("no-ops when the entry does not exist", () => {
      useExplorationAutomationStore.getState().update("nope", { scopeRadius: 5 });
      expect(useExplorationAutomationStore.getState().entries["nope"]).toBeUndefined();
    });
  });

  describe("toggleActive", () => {
    it("pauses an active entry but keeps the previous nextRunAt", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      const beforePause = useExplorationAutomationStore.getState().entries[id].nextRunAt;
      useExplorationAutomationStore.getState().toggleActive(id);
      const entry = useExplorationAutomationStore.getState().entries[id];
      expect(entry.active).toBe(false);
      expect(entry.nextRunAt).toBe(beforePause);
    });

    it("resuming preserves a still-future nextRunAt", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: false,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      const future = FROZEN_NOW + 60_000;
      useExplorationAutomationStore.getState().update(id, { nextRunAt: future });
      useExplorationAutomationStore.getState().toggleActive(id, true);
      expect(useExplorationAutomationStore.getState().entries[id].active).toBe(true);
      expect(useExplorationAutomationStore.getState().entries[id].nextRunAt).toBe(future);
    });

    it("resuming reschedules from now when the stored nextRunAt is stale", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: false,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().update(id, { nextRunAt: FROZEN_NOW - 1_000 });
      useExplorationAutomationStore.getState().toggleActive(id, true);
      expect(useExplorationAutomationStore.getState().entries[id].nextRunAt).toBe(
        FROZEN_NOW + EXPLORATION_AUTOMATION_INTERVAL_MS,
      );
    });

    it("no-ops when the entry does not exist", () => {
      useExplorationAutomationStore.getState().toggleActive("nope");
      expect(useExplorationAutomationStore.getState().entries["nope"]).toBeUndefined();
    });
  });

  describe("scheduleNext", () => {
    it("uses now when no base is provided", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().scheduleNext(id);
      expect(useExplorationAutomationStore.getState().entries[id].nextRunAt).toBe(
        FROZEN_NOW + EXPLORATION_AUTOMATION_INTERVAL_MS,
      );
    });

    it("respects an explicit base", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().scheduleNext(id, 5_000_000);
      expect(useExplorationAutomationStore.getState().entries[id].nextRunAt).toBe(
        5_000_000 + EXPLORATION_AUTOMATION_INTERVAL_MS,
      );
    });

    it("no-ops for a missing id", () => {
      useExplorationAutomationStore.getState().scheduleNext("nope");
      expect(useExplorationAutomationStore.getState().entries["nope"]).toBeUndefined();
    });
  });

  describe("runNow", () => {
    it("forces active true and schedules nextRunAt to now", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: false,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().runNow(id);
      const entry = useExplorationAutomationStore.getState().entries[id];
      expect(entry.active).toBe(true);
      expect(entry.nextRunAt).toBe(FROZEN_NOW);
    });

    it("no-ops for a missing id", () => {
      useExplorationAutomationStore.getState().runNow("nope");
      expect(useExplorationAutomationStore.getState().entries["nope"]).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("drops the entry", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().remove(id);
      expect(useExplorationAutomationStore.getState().entries[id]).toBeUndefined();
    });
  });

  describe("pruneForGame", () => {
    it("drops entries from other gameIds", () => {
      const kept = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      const stale = useExplorationAutomationStore.getState().add({
        explorerId: "2",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
        gameId: "older-game",
      });
      useExplorationAutomationStore.getState().pruneForGame(FROZEN_GAME_ID);
      expect(useExplorationAutomationStore.getState().entries[kept]).toBeDefined();
      expect(useExplorationAutomationStore.getState().entries[stale]).toBeUndefined();
    });

    it("no-ops when every entry already matches the gameId", () => {
      const id = useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      const before = useExplorationAutomationStore.getState().entries;
      useExplorationAutomationStore.getState().pruneForGame(FROZEN_GAME_ID);
      // Reference equality — no-op must avoid churning the entries map.
      expect(useExplorationAutomationStore.getState().entries).toBe(before);
      expect(useExplorationAutomationStore.getState().entries[id]).toBeDefined();
    });
  });

  describe("pauseAll / resumeAll", () => {
    it("pauseAll flips everything inactive and clears nextRunAt", () => {
      useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().add({
        explorerId: "2",
        active: true,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().pauseAll();
      Object.values(useExplorationAutomationStore.getState().entries).forEach((entry) => {
        expect(entry.active).toBe(false);
        expect(entry.nextRunAt).toBeNull();
      });
    });

    it("resumeAll flips everything active and reschedules from now", () => {
      useExplorationAutomationStore.getState().add({
        explorerId: "1",
        active: false,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().add({
        explorerId: "2",
        active: false,
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
      });
      useExplorationAutomationStore.getState().resumeAll();
      Object.values(useExplorationAutomationStore.getState().entries).forEach((entry) => {
        expect(entry.active).toBe(true);
        expect(entry.nextRunAt).toBe(FROZEN_NOW + EXPLORATION_AUTOMATION_INTERVAL_MS);
      });
    });
  });
});
