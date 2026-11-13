// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactChange } from "@bibliothecadao/eternum/game-client";
import { expect, it, vi } from "vitest";

import { ArmyManager } from "./army-manager";
import { StructureManager } from "./structure-manager";

/** A store that hands its one listener back, so a test can deliver the changes a fact page brings. */
const listeningStore = () => {
  let listener: (changes: readonly NativeFactChange[]) => void = () => {};
  return {
    store: { subscribe: (heard: typeof listener) => ((listener = heard), () => {}) },
    deliver: (changes: object[]) => listener(changes as never),
  };
};

const homeAspect = (game_id: number) => ({
  model: "HomeAspect",
  current: { game_id, home: 7n, aspect: 3 },
  previous: undefined,
});
const unrelated = { model: "TileOpt", current: { game_id: 1 }, previous: undefined };

it.each([
  [
    "every army's side",
    (store: object) => {
      const manager = Object.assign(Object.create(ArmyManager.prototype), { store, recheckOwnership: vi.fn() });
      manager.subscribeToAlliances();
      return () => manager.recheckOwnership.mock.calls.length;
    },
  ],
  [
    "every structure's side",
    (store: object) => {
      const manager = Object.assign(Object.create(StructureManager.prototype), {
        store,
        storeUnsubscribes: [],
        structureInfoCache: new Map([[7, {}]]),
        requestVisibleStructuresRefresh: vi.fn(),
      });
      manager.subscribeToAlliances();
      return () => manager.requestVisibleStructuresRefresh.mock.calls.length;
    },
  ],
])("redraws %s when a home's Aspect arrives in the game, and not for another game or another fact", (_, mount) => {
  configManager.setActiveGame(1, 7);
  const { store, deliver } = listeningStore();
  const redraws = mount(store);
  deliver([unrelated]);
  deliver([homeAspect(2)]);
  expect(redraws()).toBe(0);
  deliver([unrelated, homeAspect(1)]);
  expect(redraws()).toBe(1);
});
