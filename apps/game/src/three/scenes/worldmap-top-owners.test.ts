import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { bindChainTime } from "@/sync/chain-time-binding";
import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { followTopOwners, rankTopOwners, type ChangeSource } from "./worldmap-top-owners";

const GAME = 23;
/** Player 0xa holds tenth place on 10 points; 0xb has none, but holds a hyperstructure's whole share at 1 point a second. */
const A = "a";
const B = "b";

/** A game's facts as the chain writes them: nine players on 2,000 points, `a` on 10, `b` with a share from t=100. */
const gameAt = (seconds: number) => {
  const store = new NativeFactStore();
  configManager.setActiveGame(GAME, 3);
  store.setSnapshot({ gameId: GAME, complete: true, actor: "0x1", timestamp: seconds });
  const put = (model: string, value: Record<string, unknown>) =>
    store.applyFacts([
      {
        model,
        key: hash.computePoseidonHashOnElements(
          value.address !== undefined
            ? [GAME, value.address as bigint]
            : value.entity_id !== undefined
              ? [GAME, value.entity_id as number]
              : [GAME],
        ),
        value,
      },
    ] as never);
  put("SliceRules", {
    ...preset.rules,
    game_id: GAME,
    victory_points_grant_config: { ...preset.rules.victory_points_grant_config, hyp_points_per_second: 1_000_000 },
  });
  put("GameRegistry", {
    game_id: GAME,
    preset_id: 3,
    name: 1n,
    start_settling_at: 1n,
    start_main_at: 1n,
    end_at: 1000n,
    settled: false,
    ready: true,
    dev_mode_on: false,
    end_grace_seconds: 0,
    seed: 1n,
  });
  for (let player = 1; player <= 11; player += 1)
    put("PlayerPoints", {
      game_id: GAME,
      address: BigInt(player),
      points: BigInt(player < 10 ? 2000 : player === 10 ? 10 : 0) * 1_000_000n,
    });
  put("HyperstructureShares", {
    game_id: GAME,
    entity_id: 7,
    start_at: 100n,
    multiplier: 1,
    shareholders: [{ player: 11n, bps: 10_000 }],
  });
  configManager.setStore(store);
  return { store, put };
};

/** The chain clock as Herald anchors it, at `seconds`. */
const anchorClock = (seconds: number) =>
  useChainTimeStore.getState().anchor({ timestamp: seconds * 1000, blockNumber: seconds, source: "test" } as never);

/** The world map's side: the top ten its plates were given, rebuilt (counted) at each change. */
const scene = (store: NativeFactStore, clock?: ChangeSource) => {
  const state = { shown: rankTopOwners(store), rebuilds: 0, stop: () => {} };
  state.stop = followTopOwners(store, {
    shown: () => state.shown,
    onChange: () => {
      state.rebuilds += 1;
      state.shown = rankTopOwners(store);
    },
    ...(clock ? { clock } : {}),
  });
  return state;
};

describe("the mid band's top ten follows what it is ranked from (review-missing-plates-1)", () => {
  beforeEach(() => {
    bindChainTime();
    anchorClock(100);
  });

  afterEach(() => setBlockTimestampSource(null));

  it("takes in a shareholder whose points cross tenth place on the chain clock alone, no fact changing", () => {
    const { store } = gameAt(100);
    const map = scene(store);
    expect([map.shown.has(A), map.shown.has(B)]).toEqual([true, false]);

    // A hundred seconds of the share's points (100), past `a`'s 10: only the chain clock moved.
    anchorClock(200);
    expect([map.shown.has(A), map.shown.has(B)]).toEqual([false, true]);
    expect(map.rebuilds).toBe(1);
    map.stop();
  });

  it("follows a points row moving a player in and out of the ten", () => {
    const { store, put } = gameAt(100);
    const map = scene(store);
    put("PlayerPoints", { game_id: GAME, address: 11n, points: 50n * 1_000_000n });
    expect([map.shown.has(A), map.shown.has(B)]).toEqual([false, true]);
    put("PlayerPoints", { game_id: GAME, address: 10n, points: 60n * 1_000_000n });
    expect([map.shown.has(A), map.shown.has(B)]).toEqual([true, false]);
    expect(map.rebuilds).toBe(2);
    map.stop();
  });

  it("re-ranks on a snapshot change with no row in it", () => {
    const { store } = gameAt(100);
    const silent: ChangeSource = { subscribe: () => () => {} };
    const map = scene(store, silent);
    // The clock the ranking reads moves, unannounced; the snapshot taken at that time is what tells.
    setBlockTimestampSource(() => 200);
    store.setSnapshot({ gameId: GAME, complete: true, actor: "0x1", timestamp: 200 });
    expect([map.shown.has(A), map.shown.has(B)]).toEqual([false, true]);
    expect(map.rebuilds).toBe(1);
    map.stop();
  });

  it("rebuilds nothing while the ten's members stay the same", () => {
    const { store, put } = gameAt(100);
    const map = scene(store);
    put("PlayerPoints", { game_id: GAME, address: 1n, points: 2500n * 1_000_000n });
    anchorClock(105);
    expect(map.rebuilds).toBe(0);
    map.stop();
  });

  it("stops following once stopped", () => {
    const { store, put } = gameAt(100);
    const map = scene(store);
    map.stop();
    anchorClock(200);
    put("PlayerPoints", { game_id: GAME, address: 10n, points: 0n });
    expect(map.rebuilds).toBe(0);
    expect(map.shown.has(A)).toBe(true);
  });
});
