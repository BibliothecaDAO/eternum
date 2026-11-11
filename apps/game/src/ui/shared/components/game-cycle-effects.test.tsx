import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio", () => ({ useUISound: () => () => {} }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ audio: { tickGongSound: "gong" } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentArmiesTick: () => 1 }));
vi.mock("@/game-entry/world-interactive", () => ({ isWorldInteractive: () => true }));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { SURFACE_MOOD_PROGRESS } from "@/utils/cycle-progress";

import { GameCycleEffects } from "./game-cycle-effects";

let unmount: (() => void) | null = null;
const render = (node: React.ReactNode) => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  act(() => root.render(node));
  unmount = () => act(() => root.unmount());
};

afterEach(() => {
  unmount?.();
  act(() => useUIStore.getState().setDebugCycleProgressOverride(null));
});

describe("the moment the map is lit at", () => {
  it("is the Surface's late golden afternoon, whatever the game's time", () => {
    render(<GameCycleEffects />);
    expect(useUIStore.getState().cycleProgress).toBe(SURFACE_MOOD_PROGRESS);
  });

  it("is the moment a lab asks for, and the golden afternoon again once it lets go", () => {
    render(<GameCycleEffects />);
    act(() => useUIStore.getState().setDebugCycleProgressOverride(10));
    expect(useUIStore.getState().cycleProgress).toBe(10);
    act(() => useUIStore.getState().setDebugCycleProgressOverride(null));
    expect(useUIStore.getState().cycleProgress).toBe(SURFACE_MOOD_PROGRESS);
  });
});
