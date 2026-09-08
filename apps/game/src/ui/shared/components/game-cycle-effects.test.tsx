import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  tick: 3,
  now: 180,
  override: null as number | null,
  gong: vi.fn(),
  setProgress: vi.fn(),
}));
vi.mock("@/audio", () => ({ useUISound: () => mocks.gong }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ audio: { tickGongSound: "gong" } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentArmiesTick: () => mocks.tick,
  useCurrentBlockTimestamp: () => mocks.now,
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: any) =>
    select({ debugCycleProgressOverride: mocks.override, setCycleProgress: mocks.setProgress }),
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getTick: () => 60 } }));
import { GameCycleEffects } from "./game-cycle-effects";
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  Object.assign(mocks, { tick: 3, now: 180, override: null });
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = () => act(async () => root.render(<GameCycleEffects />));
it("keeps the gong on army-tick changes without sounding on mount or within a tick", async () => {
  await render();
  expect(mocks.gong).not.toHaveBeenCalled();
  mocks.now = 181;
  await render();
  expect(mocks.gong).not.toHaveBeenCalled();
  mocks.tick = 4;
  mocks.now = 240;
  await render();
  expect(mocks.gong).toHaveBeenCalledTimes(1);
});
it("writes atmospheric progress and respects debug overrides", async () => {
  await render();
  expect(mocks.setProgress).toHaveBeenLastCalledWith(50);
  mocks.override = 20;
  await render();
  expect(mocks.setProgress).toHaveBeenLastCalledWith(20);
});
