// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { Matrix4 } from "three";
import { createChestPool } from "@/three/rewards/chest-pool-fixture";
import type { ChestTransitions } from "@/three/rewards/chest-transitions";
import { type ReadyStage, ScreenCentreStage } from "@/three/rewards/screen-centre-stage";
import { announcedRewardChestBeats, type RewardChestRequest } from "@/three/scenes/worldmap-reward-chest-request";
import { ChestLordsMoment } from "./chest-lords-moment";

const RUIN: RewardChestRequest = {
  rarity: 3,
  lords: 1_250,
  prizes: [
    { name: "XP", figure: "+136 XP" },
    { icon: "skull", name: "troops", figure: "−4" },
  ],
};

let pool: ChestTransitions;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let clock = 4;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // The veil's fades finish at once, so the test reads where the moment ends.
  MotionGlobalConfig.skipAnimations = true;
  plays.length = 0;
  stops.length = 0;
  clock = 4;
  pool = createChestPool();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(createElement(ChestLordsMoment)));
});

afterEach(() => {
  act(() => {
    pool.dispose();
    root.unmount();
  });
  host.remove();
  MotionGlobalConfig.skipAnimations = false;
});

/** The world map staging a reward's chest at the centre, as it does on a ruin's clear. */
const present = (request: RewardChestRequest, placement = new Matrix4()) =>
  act(async () => void pool.present("centre", placement, clock, announcedRewardChestBeats(request)));

/** A rendered frame `seconds` after the last, the chest's own clock advancing with it. */
const frame = (seconds: number) =>
  act(async () => {
    clock += seconds;
    pool.update(seconds, clock);
  });

/** What the player sees of the chest and its moment, as one reading: they must always agree. */
const scene = () => {
  const moment = document.querySelector<HTMLElement>("[data-chest-moment]");
  return {
    chest: pool.has("centre"),
    veil: Boolean(moment?.querySelector(".ui-chest-moment__veil")),
    lords: moment?.querySelector(".ui-chest-moment__figure")?.getAttribute("aria-label") ?? null,
    labelsHidden: document.documentElement.classList.contains("chest-moment"),
  };
};

// Owner, 28 October 2026: "the chest animation should darken the rest of the screen so the focus is on it", "the lords
// winnings ... it's the fucking biggest moment of the game make it so". The moment keeps no time of its own: it
// follows the chest's beats, so the chest, the LORDS, the veil and the hidden labels agree at every frame.
describe("a chest and its moment, on one clock", () => {
  it("veil while the chest arrives, LORDS as its lid opens, everything gone with the chest", async () => {
    await present(RUIN);
    await frame(0.5);
    expect(scene()).toEqual({ chest: true, veil: true, lords: null, labelsHidden: true });
    expect(plays).toEqual(["chest.charge"]);
    expect(document.querySelector("[data-chest-moment] button")).toBeNull();

    await frame(0.6);
    expect(scene()).toEqual({ chest: true, veil: true, lords: "1,250 LORDS", labelsHidden: true });
    expect([...document.querySelectorAll(".ui-chest-moment__prizes .ui-chip")].map((chip) => chip.textContent)).toEqual(
      ["+136 XP", "−4"],
    );
    expect(plays).toEqual(["chest.charge", "chest.tell.rare", "chest.burst", "coin.shower"]);
    expect(stops).toEqual([{ id: "chest.charge" }]);

    await frame(3);
    expect(scene()).toEqual({ chest: false, veil: false, lords: null, labelsHidden: false });
  });

  it("holds the veil through a long gap between frames, and shows the LORDS only when the lid actually opens", async () => {
    await present(RUIN);
    await frame(0.5);
    // A four-second gap (a tab in the background): no timer of the moment's own has run out meanwhile.
    await frame(4);
    expect(scene()).toEqual({ chest: true, veil: true, lords: "1,250 LORDS", labelsHidden: true });
    await frame(3);
    expect(scene()).toEqual({ chest: false, veil: false, lords: null, labelsHidden: false });
  });

  it("restarts on a second reward during the first's arrival: one chest, one moment, the second's LORDS", async () => {
    await present(RUIN);
    await frame(0.8);
    await present({ ...RUIN, rarity: 1, lords: 40 }, new Matrix4().makeTranslation(3, 0, 0));
    // The first's charge stops; the second's starts; its LORDS wait for its own lid.
    expect(stops).toEqual([{ id: "chest.charge" }]);
    expect(plays).toEqual(["chest.charge", "chest.charge"]);
    await frame(0.3);
    expect(scene()).toEqual({ chest: true, veil: true, lords: null, labelsHidden: true });
    await frame(0.8);
    expect(scene()).toEqual({ chest: true, veil: true, lords: "40 LORDS", labelsHidden: true });
    expect(plays.slice(2)).toEqual(["chest.tell.common", "chest.burst", "coin.shower"]);
    await frame(3);
    expect(scene()).toEqual({ chest: false, veil: false, lords: null, labelsHidden: false });
  });

  it("ends with the chest when the map is left or its chunk cleared mid-moment, labels back", async () => {
    await present(RUIN);
    await frame(0.5);
    // What the world map does as it is switched off (ChestManager.endScreenCentrePresentation).
    await act(async () => pool.cancel("centre"));
    expect(scene()).toEqual({ chest: false, veil: false, lords: null, labelsHidden: false });
    expect(stops).toEqual([{ id: "chest.charge" }]);

    await present(RUIN);
    await frame(1.2);
    expect(scene().lords).toBe("1,250 LORDS");
    // A chunk change clears the pool.
    await act(async () => pool.clear());
    expect(scene()).toEqual({ chest: false, veil: false, lords: null, labelsHidden: false });
  });
});

/** A chest model still loading: the stage waits on it until the test lets it finish. */
const loadingModel = () => {
  const loads: Array<() => void> = [];
  const stage = new ScreenCentreStage(
    () =>
      new Promise<ReadyStage>((ready) =>
        loads.push(() => ready({ transitions: pool, placement: new Matrix4(), time: clock })),
      ),
  );
  /** The model finishes loading: every request waiting on it carries on. */
  const finish = () =>
    act(async () => {
      loads.splice(0).forEach((load) => load());
    });
  return { stage, finish };
};

/** A reward's request, as the world map makes it on a ruin's clear: staged once its chest's model is ready. */
const request = (stage: ScreenCentreStage, reward: RewardChestRequest) =>
  act(async () => void stage.present(announcedRewardChestBeats(reward)));

// Review, 28 October 2026: cancelling a presentation must also cancel its pending model load.
describe("a chest whose model is still loading when its moment is cut short", () => {
  it("stages nothing once the load finishes if the map was left meanwhile: no chest, veil or charge", async () => {
    const { stage, finish } = loadingModel();
    await request(stage, RUIN);
    // The world map is left (WorldmapScene.onSwitchOff → ChestManager.endScreenCentrePresentation).
    await act(async () => stage.end(pool));
    await finish();
    expect(scene()).toEqual({ chest: false, veil: false, lords: null, labelsHidden: false });
    expect(plays).toEqual([]);
  });

  it("never revives an old request after leaving and coming back: only the request made since plays", async () => {
    const { stage, finish } = loadingModel();
    await request(stage, RUIN);
    await act(async () => stage.end(pool));
    // Back on the map, another ruin is cleared while the same model is still loading.
    await request(stage, { ...RUIN, lords: 40 });
    await finish();
    expect(scene()).toEqual({ chest: true, veil: true, lords: null, labelsHidden: true });
    expect(plays).toEqual(["chest.charge"]);
    await frame(1.1);
    expect(scene().lords).toBe("40 LORDS");
  });

  it("stages only the latest of two requests made while loading", async () => {
    const { stage, finish } = loadingModel();
    await request(stage, RUIN);
    await request(stage, { ...RUIN, lords: 40 });
    await finish();
    await frame(1.1);
    expect(scene()).toEqual({ chest: true, veil: true, lords: "40 LORDS", labelsHidden: true });
    expect(plays.filter((id) => id === "chest.charge")).toHaveLength(1);
  });
});
