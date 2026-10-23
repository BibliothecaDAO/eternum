import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_END_TIMING, RESTING, useDayEndStore } from "@/hooks/store/use-day-end-store";

import { ExpeditionRollover } from "./expedition-rollover";

/** The clocks read as season days, a realm for the player (or none), and the map's two sinks. */
const world = vi.hoisted(() => ({
  chainDay: 1,
  blockDay: 1,
  player: "0x1" as string | null,
  navigate: vi.fn(),
  rebuild: vi.fn(),
  /** The game's store is one object for the game's life, as `setup.store` is. */
  store: { structuresOwnedBy: () => [{ entity_id: 12 }] },
}));

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: world.store } }) }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) =>
    select({ account: world.player ? { address: world.player } : null }),
}));
vi.mock("@/hooks/store/use-chain-time-store", () => ({
  useChainTimeStore: { getState: () => ({ getNowSeconds: () => world.chainDay }) },
}));
// As the game's hook does, a new navigation function on every render.
vi.mock("@/hooks/helpers/use-navigate", () => ({
  useNavigateToMapView: () => (position: unknown) => world.navigate(position),
}));
vi.mock("@bibliothecadao/eternum/game-sync", () => ({
  getActiveGameSyncRuntime: () => ({ getWorldSpatialProjection: () => ({ rebuild: world.rebuild }) }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getActiveGameId: () => 1 },
  readExpeditionRules: () => ({}),
  seasonDay: (_rules: unknown, day: number) => day,
  getBlockTimestamp: () => ({ currentBlockTimestamp: world.blockDay }),
  entityHomeNamespace: () => 12,
  isExpeditionRealm: () => true,
  expeditionRealmSite: (_rules: unknown, _home: unknown, day: number) => ({ col: day * 100, row: 50 }),
  Position: { fromContract: (position: unknown) => position },
}));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
const seconds = (count: number) =>
  act(() => {
    vi.advanceTimersByTime(count * 1_000);
  });
const phase = () => useDayEndStore.getState().phase;
const NEW_SITE = { x: 200, y: 50 };

/** Skips the mist to the summary and continues into the black. */
const continueIntoTheBlack = () => {
  act(() => {
    useDayEndStore.getState().skip();
    useDayEndStore.getState().continueDay();
  });
  seconds(DAY_END_TIMING.nightfall);
};

const mount = () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<ExpeditionRollover />));
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  Object.assign(world, { chainDay: 1, blockDay: 1, player: "0x1" });
  world.navigate.mockReset();
  world.rebuild.mockReset();
  useDayEndStore.setState({ ...RESTING, summary: "shown" });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useDayEndStore.setState(RESTING);
  vi.useRealTimers();
});

describe("a player's day turning", () => {
  it("holds the block clock's re-projection and the camera for the black, then lifts it onto the new land", () => {
    mount();
    world.chainDay = 2;
    seconds(1);
    expect(phase()).toBe("veil");
    world.blockDay = 2;
    seconds(1);
    expect(world.rebuild).not.toHaveBeenCalled();
    expect(world.navigate).not.toHaveBeenCalled();
    continueIntoTheBlack();
    expect(world.rebuild).toHaveBeenCalledTimes(1);
    expect(world.navigate).toHaveBeenCalledWith(NEW_SITE);
    seconds(DAY_END_TIMING.black);
    expect(phase()).toBe("dawn");
  });

  it("holds the black for a block that arrives during it, then moves the camera before the dawn", () => {
    mount();
    world.chainDay = 2;
    seconds(1);
    continueIntoTheBlack();
    expect(world.navigate).not.toHaveBeenCalled();
    world.blockDay = 2;
    seconds(1);
    expect(world.rebuild).toHaveBeenCalledTimes(1);
    expect(world.navigate).toHaveBeenCalledWith(NEW_SITE);
    expect(phase()).toBe("dawn");
  });

  it("keeps the old land until the black when both clocks turn between two looks", () => {
    mount();
    world.chainDay = 2;
    world.blockDay = 2;
    seconds(1);
    expect(phase()).toBe("veil");
    expect(world.rebuild).not.toHaveBeenCalled();
    continueIntoTheBlack();
    expect(world.rebuild).toHaveBeenCalledTimes(1);
    expect(world.navigate).toHaveBeenCalledWith(NEW_SITE);
  });

  it("still re-projects and moves the camera when the block arrives after the black's longest hold", () => {
    mount();
    world.chainDay = 2;
    seconds(1);
    continueIntoTheBlack();
    seconds(DAY_END_TIMING.blackHold + DAY_END_TIMING.dawn);
    expect(phase()).toBe("day");
    expect(world.rebuild).not.toHaveBeenCalled();
    world.blockDay = 2;
    seconds(1);
    expect(world.rebuild).toHaveBeenCalledTimes(1);
    expect(world.navigate).toHaveBeenCalledWith(NEW_SITE);
  });

  it("keeps the turn's due camera move when a map navigation renders it again before the late block", () => {
    mount();
    world.chainDay = 2;
    seconds(1);
    continueIntoTheBlack();
    seconds(DAY_END_TIMING.blackHold + DAY_END_TIMING.dawn);
    expect(phase()).toBe("day");
    act(() => root.render(<ExpeditionRollover />));
    world.blockDay = 2;
    seconds(1);
    expect(world.rebuild).toHaveBeenCalledTimes(1);
    expect(world.navigate).toHaveBeenCalledWith(NEW_SITE);
  });
});

describe("a player who opens the game after the day ended", () => {
  it("brings the camera onto the realm's site in the black their Continue drops to", () => {
    world.chainDay = 2;
    world.blockDay = 2;
    mount();
    act(() => useDayEndStore.getState().begin("later"));
    expect(world.navigate).not.toHaveBeenCalled();
    act(() => useDayEndStore.getState().continueDay());
    seconds(DAY_END_TIMING.nightfall);
    expect(world.navigate).toHaveBeenCalledWith(NEW_SITE);
    expect(world.rebuild).not.toHaveBeenCalled();
    seconds(DAY_END_TIMING.black);
    expect(phase()).toBe("dawn");
  });
});

describe("a viewer with no realm", () => {
  it("plays no moment and re-projects as soon as the block clock turns", () => {
    world.player = null;
    mount();
    world.chainDay = 2;
    seconds(1);
    expect(phase()).toBe("day");
    world.blockDay = 2;
    seconds(1);
    expect(world.rebuild).toHaveBeenCalledTimes(1);
    expect(world.navigate).not.toHaveBeenCalled();
  });
});
