import { ClientConfigManager } from "@bibliothecadao/eternum";
import { ContractAddress, getNeighborHexes } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";

import { isActionable, observeWorld, summariseDelta } from "./delta";
import { createFakeGame, PLAYER, seedExplorer, seedGameRegistry, seedStructure } from "./test-support/fake-game";

const RIVAL = ContractAddress(0xdefn);
const HOME = { x: 100, y: 100 };
const FAR_AWAY = { x: 160, y: 160 };

afterEach(() => {
  ClientConfigManager.instance().setActiveGame(0, 0);
});

const settledGame = () => {
  const game = createFakeGame();
  seedGameRegistry(game.components, { status: "Live", startMainAt: 0, endAt: 0 });
  seedStructure(game.components, { entityId: 12, owner: PLAYER, x: HOME.x, y: HOME.y });
  seedStructure(game.components, { entityId: 13, owner: RIVAL, x: FAR_AWAY.x, y: FAR_AWAY.y });
  const spawn = getNeighborHexes(HOME.x, HOME.y)[0]!;
  seedExplorer(game.components, { explorerId: 101, owner: 12, x: spawn.col, y: spawn.row });
  return game;
};

describe("delta gate", () => {
  it("finds nothing actionable in a world delta when nothing of mine changed, but always wakes on a heartbeat", () => {
    const game = settledGame();
    const before = observeWorld(game);

    const delta = summariseDelta(before, observeWorld(game));

    expect(delta).toMatchObject({ phase: null, ownStructures: [], ownArmies: [], hostilesAppeared: [] });
    expect(isActionable(delta, "world-delta")).toBe(false);
    expect(isActionable(delta, "heartbeat")).toBe(true);
    expect(isActionable(delta, "direction")).toBe(true);
    expect(isActionable(delta, "startup")).toBe(true);
  });

  it("wakes when a hostile army enters reach or moves inside it, but not when it leaves", () => {
    const game = settledGame();
    const before = observeWorld(game);

    seedExplorer(game.components, { explorerId: 201, owner: 13, x: HOME.x + 2, y: HOME.y + 1 });
    const appeared = summariseDelta(before, observeWorld(game));
    expect(appeared.hostilesAppeared).toEqual([201]);
    expect(isActionable(appeared, "world-delta")).toBe(true);

    const seen = observeWorld(game);
    seedExplorer(game.components, { explorerId: 201, owner: 13, x: HOME.x + 1, y: HOME.y + 1 });
    const moved = summariseDelta(seen, observeWorld(game));
    expect(moved.hostilesMoved).toEqual([201]);
    expect(isActionable(moved, "world-delta")).toBe(true);

    const close = observeWorld(game);
    seedExplorer(game.components, { explorerId: 201, owner: 13, x: FAR_AWAY.x, y: FAR_AWAY.y });
    const left = summariseDelta(close, observeWorld(game));
    expect(left.hostilesLeft).toEqual([201]);
    expect(isActionable(left, "world-delta")).toBe(false);
  });

  it("does not count my own second explorer as hostile", () => {
    const game = settledGame();
    const before = observeWorld(game);

    seedExplorer(game.components, { explorerId: 102, owner: 12, x: HOME.x - 1, y: HOME.y });
    const delta = summariseDelta(before, observeWorld(game));

    expect(delta.hostilesAppeared).toEqual([]);
    expect(delta.ownArmies).toEqual([102]);
  });

  it("wakes when my army moves or my structure changes", () => {
    const game = settledGame();
    const before = observeWorld(game);

    seedExplorer(game.components, { explorerId: 101, owner: 12, x: HOME.x + 3, y: HOME.y });
    expect(summariseDelta(before, observeWorld(game)).ownArmies).toEqual([101]);

    const afterMove = observeWorld(game);
    seedStructure(game.components, { entityId: 12, owner: PLAYER, x: HOME.x, y: HOME.y, level: 2 });
    expect(summariseDelta(afterMove, observeWorld(game)).ownStructures).toEqual([12]);
  });

  it("reports a phase change as actionable on any wake", () => {
    const game = settledGame();
    const before = observeWorld(game);

    seedGameRegistry(game.components, { status: "Ended", startMainAt: 0, endAt: 0 });
    const delta = summariseDelta(before, observeWorld(game));

    expect(delta.phase).toEqual({ from: "live", to: "ended" });
    expect(isActionable(delta, "world-delta")).toBe(true);
  });
});
