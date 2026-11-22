import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const day = vi.hoisted(() => ({
  rules: null as { name: string } | null,
  shareLeft: 1 as number | undefined,
  now: 1_000,
  blockNow: 300,
  tickDuration: 100,
  clock: vi.fn(),
}));

vi.mock("@/audio", () => ({ useUISound: () => () => {} }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ audio: { tickGongSound: "gong" } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentArmiesTick: () => 1,
  useCurrentBlockTimestamp: () => day.blockNow,
  useCoarseNowSeconds: () => day.now,
}));
vi.mock("@/game-entry/world-interactive", () => ({ isWorldInteractive: () => true }));
vi.mock("@/ui/features/frontier/frontier-home", () => ({ useExpeditionRules: () => day.rules }));
vi.mock("@/ui/features/frontier/hud/day-clock", () => ({
  dayClock: (rules: unknown, now: number) => {
    day.clock(rules, now);
    return { shareLeft: day.shareLeft };
  },
}));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<object>()),
  configManager: { getTick: () => day.tickDuration },
  isEtherealTile: (_rules: unknown, hex: { row: number; alt: boolean }) => hex.alt || hex.row >= 100,
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { DAY_PHASE_PROGRESS, SURFACE_MOOD_PROGRESS } from "@/utils/cycle-progress";

import { GameCycleEffects } from "./game-cycle-effects";

let unmount: (() => void) | null = null;
const render = () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  act(() => root.render(<GameCycleEffects />));
  unmount = () => act(() => root.unmount());
};
const frontierDay = (shareLeft: number | undefined) => {
  day.rules = { name: "frontier" };
  day.shareLeft = shareLeft;
};
const progress = () => useUIStore.getState().cycleProgress;

afterEach(() => {
  unmount?.();
  day.rules = null;
  day.shareLeft = 1;
  day.clock.mockClear();
  act(() => {
    useUIStore.getState().setDebugCycleProgressOverride(null);
    useUIStore.setState({ cameraTargetHex: null, mapLayer: false });
  });
});

describe("the moment the map is lit at", () => {
  it("keeps the six-tick army day cycle in a game without Frontier expedition rules", () => {
    render();
    expect(progress()).toBeCloseTo(50, 6);
  });

  it.each([
    [1, DAY_PHASE_PROGRESS.morning],
    [0.75, 125 / 3],
    [0.2, DAY_PHASE_PROGRESS.lateAfternoon],
    [0, DAY_PHASE_PROGRESS.dusk],
  ])("follows Frontier's day: with %s of it left, the light is at %s", (shareLeft, expected) => {
    frontierDay(shareLeft);
    render();
    expect(progress()).toBeCloseTo(expected, 6);
  });

  it("reads the day from the season's rules at the chain's coarse now", () => {
    frontierDay(0.5);
    render();
    expect(day.clock).toHaveBeenCalledWith(day.rules, day.now);
  });

  it("is the golden afternoon outside the season's days", () => {
    frontierDay(undefined);
    render();
    expect(progress()).toBe(SURFACE_MOOD_PROGRESS);
  });

  it("is the golden afternoon while the camera is on an Ethereal layer, and the day's again back on the Surface", () => {
    frontierDay(1);
    act(() => useUIStore.setState({ cameraTargetHex: { col: 5, row: 140 } }));
    render();
    expect(progress()).toBe(SURFACE_MOOD_PROGRESS);
    act(() => useUIStore.setState({ cameraTargetHex: { col: 5, row: 20 } }));
    expect(progress()).toBeCloseTo(DAY_PHASE_PROGRESS.morning, 6);
  });

  it("is the moment a lab asks for, and the day's again once it lets go", () => {
    frontierDay(1);
    render();
    act(() => useUIStore.getState().setDebugCycleProgressOverride(10));
    expect(progress()).toBe(10);
    act(() => useUIStore.getState().setDebugCycleProgressOverride(null));
    expect(progress()).toBeCloseTo(DAY_PHASE_PROGRESS.morning, 6);
  });
});
