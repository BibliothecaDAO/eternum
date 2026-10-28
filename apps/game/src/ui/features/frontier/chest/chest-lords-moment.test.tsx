// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { plays, stops } = vi.hoisted(() => ({ plays: [] as string[], stops: [] as unknown[] }));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({
      play: (id: string) => (plays.push(id), Promise.resolve({ id })),
      stop: (source: unknown) => stops.push(source),
    }),
  },
}));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {}, useReducedMotion: () => true }));

import { MotionGlobalConfig } from "framer-motion";
import { PRESENTED_CHEST_BEATS } from "@/three/rewards/chest-transitions";
import { announceRewardChestShown } from "@/three/scenes/worldmap-reward-chest-request";
import { ChestLordsMoment } from "./chest-lords-moment";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  // The veil's fades finish at once, so the test reads where the moment ends.
  MotionGlobalConfig.skipAnimations = true;
  plays.length = 0;
  stops.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  MotionGlobalConfig.skipAnimations = false;
});

// Owner, 28 October 2026: "the chest animation should darken the rest of the screen so the focus is on it", "the lords
// winnings ... it's the fucking biggest moment of the game make it so".
it("veils the screen while the chest plays, makes its LORDS the hero as it opens, and lifts by itself", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ChestLordsMoment)));
  const moment = () => document.querySelector<HTMLElement>("[data-chest-moment]");
  expect(moment()).toBeNull();
  expect(document.documentElement.classList.contains("chest-moment")).toBe(false);

  act(() =>
    announceRewardChestShown({
      rarity: 3,
      lords: 1_250,
      prizes: [
        { name: "XP", figure: "+136 XP" },
        { icon: "skull", name: "troops", figure: "−4" },
      ],
    }),
  );
  // The chest arrives: the screen is veiled over the whole page, nothing to press, its charge playing.
  expect(moment()?.parentElement).toBe(document.body);
  expect(moment()?.querySelector(".ui-chest-moment__veil")).not.toBeNull();
  expect(moment()?.querySelector("button")).toBeNull();
  expect(moment()?.querySelector(".ui-chest-moment__figure")).toBeNull();
  // The map's labels and plates step aside while it plays (hud-sheet.css: .chest-moment #labelrenderer).
  expect(document.documentElement.classList.contains("chest-moment")).toBe(true);
  expect(plays).toEqual(["chest.charge"]);

  // The lid opens: its LORDS are the hero, the rest small under them, to its rarity's tell, burst and coins.
  await act(async () => void vi.advanceTimersByTime(PRESENTED_CHEST_BEATS.opens * 1_000));
  expect(moment()?.querySelector('[aria-label="1,250 LORDS"]')).not.toBeNull();
  expect(moment()?.querySelector(".ui-chest-moment__hero")?.getAttribute("data-tier")).toBe("3");
  expect([...moment()!.querySelectorAll(".ui-chest-moment__prizes .ui-chip")].map((chip) => chip.textContent)).toEqual([
    "+136 XP",
    "−4",
  ]);
  expect(plays).toEqual(["chest.charge", "chest.tell.rare", "chest.burst", "coin.shower"]);
  expect(stops).toEqual([{ id: "chest.charge" }]);

  // It lifts by itself as the chest goes.
  await act(async () => void vi.advanceTimersByTime(PRESENTED_CHEST_BEATS.gone * 1_000));
  await act(async () => void vi.advanceTimersByTime(1_000));
  expect(moment()).toBeNull();
  expect(document.documentElement.classList.contains("chest-moment")).toBe(false);
  act(() => root.unmount());
  host.remove();
});
