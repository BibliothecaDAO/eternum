// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { hash } from "starknet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { setBlockTimestampSource } from "../../../../../../../packages/core/src/utils/timestamp";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

const fixture = vi.hoisted(() => ({ store: null as unknown as NativeFactStore, now: 150 }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: fixture.store } }) }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCoarseNowSeconds: () => fixture.now }));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayerDisplayName: () => "Player", playerAvatarUrl: () => null }));
vi.mock("@/hooks/use-leaderboard-activity", () => ({ useLeaderboardActivity: () => ({ data: [] }) }));
vi.mock("../player/use-in-game-leaderboard", () => ({
  useInGameLeaderboard: () => ({ standingsByAddress: new Map() }),
}));
vi.mock("@/ui/design-system/icon", () => ({ Icon: () => null }));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  getIsBlitz: () => true,
  getEntityName: (id: number) => `Tower ${id}`,
}));

import { PlayerId } from "./player-id";

const PLAYER = 123n;
const put = (model: string, keys: number[], value: object) =>
  fixture.store.applyFacts([{ model, key: hash.computePoseidonHashOnElements(keys), value }] as never);
/** Hyperstructure 7: 1 points a second times 2, a quarter of it the player's, last checkpointed at `startAt`. */
const allocation = (startAt = 100n) => ({
  game_id: 23,
  entity_id: 7,
  start_at: startAt,
  multiplier: 2,
  shareholders: [
    { player: PLAYER, bps: 2_500 },
    { player: 456n, bps: 7_500 },
  ],
});

let host: HTMLDivElement;
let root: Root;
const draw = () => act(() => root.render(<PlayerId selectedPlayer={PLAYER} />));
const goTo = () => host.querySelector<HTMLButtonElement>('button[title="Go to it on the map"]')!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.now = 150;
  fixture.store = new NativeFactStore();
  fixture.store.setSnapshot({ gameId: 23, complete: true, actor: String(PLAYER), timestamp: 150 });
  configManager.setActiveGame(23, 3);
  setBlockTimestampSource(() => fixture.now);
  put("SliceRules", [23], {
    ...preset.rules,
    game_id: 23,
    victory_points_grant_config: { ...preset.rules.victory_points_grant_config, hyp_points_per_second: 1_000_000 },
  });
  put("GameRegistry", [23], {
    game_id: 23,
    preset_id: 3,
    name: 1n,
    start_settling_at: 1n,
    start_main_at: 1n,
    end_at: 200n,
    settled: false,
    ready: true,
    dev_mode_on: false,
    end_grace_seconds: 0,
    seed: 1n,
  });
  put("HyperstructureShares", [23, 7], allocation());
  put("TileOpt", [23, 0, 10, 12], { game_id: 23, alt: false, col: 10, row: 12, data: 2n << 41n });
  put("TileOccupancy", [23, 0, 10, 12], {
    game_id: 23,
    alt: false,
    col: 10,
    row: 12,
    entity_id: 7,
    category: 5,
    is_structure: true,
  });
  put("Structure", [23, 7], {
    game_id: 23,
    entity_id: 7,
    owner: 456n,
    base: {
      category: 2,
      level: 0,
      created_at: 1n,
      troop_max_guard_count: 0,
      troop_max_explorer_count: 0,
      starting_troops_granted: false,
    },
    resources_packed: 0n,
    metadata: { realm_id: 0, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
  });
  configManager.setStore(fixture.store);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setBlockTimestampSource(null);
});

describe("the hyperstructures giving a player points", () => {
  it("lists the player's current share and what it pays a second", () => {
    draw();
    expect(host.textContent).toContain("Tower 7");
    expect(host.textContent).toContain("25%");
    expect(host.textContent).toContain("0.5 points/s");
  });

  it("keeps a still-paying hyperstructure listed through a checkpoint", () => {
    draw();
    act(() => put("HyperstructureShares", [23, 7], allocation(150n)));
    expect(host.textContent).toContain("Tower 7");
  });

  it("lists none once the game has ended", () => {
    fixture.now = 250;
    draw();
    expect(host.textContent).not.toContain("Tower 7");
    expect(host.textContent).toContain("None now.");
  });

  it("goes from a realm to the map, on the hyperstructure, and selects it", () => {
    window.history.replaceState({}, "", "/g/0x1/23/hex");
    draw();
    act(() => goTo().click());
    expect(window.location.pathname).toBe("/g/0x1/23/map");
    expect(useUIStore.getState().mapSelection).toEqual({ kind: "structure", entityId: 7 });
  });

  it("moves the map to the hyperstructure when already on the map", () => {
    window.history.replaceState({}, "", "/g/0x1/23/map?col=0&row=0");
    draw();
    act(() => goTo().click());
    expect(window.location.pathname).toBe("/g/0x1/23/map");
    expect(window.location.search).not.toBe("?col=0&row=0");
    expect(useUIStore.getState().mapSelection).toEqual({ kind: "structure", entityId: 7 });
  });
});

it("player details render no retired InfoBubble panel", () => {
  draw();
  expect(host.textContent).toContain("Tower 7");
  expect(host.querySelectorAll(".hud-panel")).toHaveLength(0);
});
