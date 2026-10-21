import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import type { ProceduralTerrainDebugRendererHandle } from "@/three/debug/procedural-terrain-debug-renderer";

import { createStudioBridge } from "./bridge";
import { StudioStage } from "./stage";
import { STUDIO_TAKES } from "./takes";

const FRAME = 1 / 60;

/**
 * The studio's stage on a land that answers but draws nothing: its clock, cues, walk and take playback are the real
 * ones; its models never load, so a moment that needs one (the attack, the fall, a tier) plays as nothing.
 */
function stageOnBareLand(onCue: (name: string, args: Record<string, unknown>) => void = () => {}) {
  const stage = new StudioStage(onCue);
  const terrain = {
    sampleSurface: () => ({ height: 0 }),
    queueShroudReveal: vi.fn(),
    present: vi.fn(),
    cancelShroudReveals: vi.fn(),
  };
  Object.assign(stage, {
    context: { camera: new PerspectiveCamera(), controls: { target: new Vector3(), enabled: true }, terrain },
    pages: [{}, {}, {}, {}],
  });
  return stage;
}

/** Runs frames at the world's speed until `settled` or the frame budget runs out. */
async function rollFrames(stage: StudioStage, speed: number, settled: () => boolean) {
  for (let frame = 0; frame < 60 * 60 && !settled(); frame += 1) {
    stage.update(FRAME * speed);
    await Promise.resolve();
  }
}

function bridgeOver(stage: StudioStage) {
  const view = { setClean: vi.fn(), setTake: vi.fn((name: string | null) => name === null && stage.pose()) };
  const renderer = { strike: vi.fn(), setClock: vi.fn() } as unknown as ProceduralTerrainDebugRendererHandle;
  return { view, bridge: createStudioBridge(stage, renderer, view) };
}

describe.each([0.25, 1, 2])("at world speed %s×", (speed) => {
  it.each(Object.keys(STUDIO_TAKES))("the %s take plays every cue in order", async (name) => {
    const played: string[] = [];
    const stage = stageOnBareLand((trigger, args) => {
      played.push(trigger);
      if (trigger !== "strike") stage.trigger(trigger as never, args);
    });
    let ended = false;
    void stage.play(STUDIO_TAKES[name as keyof typeof STUDIO_TAKES].path(stage.places())).then(() => (ended = true));
    await rollFrames(stage, speed, () => ended);
    const cues = STUDIO_TAKES[name as keyof typeof STUDIO_TAKES].path(stage.places()).cues ?? [];
    expect(ended).toBe(true);
    expect(played).toEqual(cues.toSorted((a, b) => a.at - b.at).map((cue) => cue.trigger));
  });

  it("the exploration uncovers all three hexes and the explorer arrives before the take ends", async () => {
    const stage = stageOnBareLand((trigger, args) => stage.trigger(trigger as never, args));
    let ended = false;
    void stage.play(STUDIO_TAKES.explore.path(stage.places())).then(() => (ended = true));
    await rollFrames(stage, speed, () => ended);
    expect(stage.status()).toMatchObject({ explored: 3, walking: false });
  });

  it("the Hyperstructure take leaves the tower complete", async () => {
    const stage = stageOnBareLand((trigger, args) => stage.trigger(trigger as never, args));
    let ended = false;
    void stage.play(STUDIO_TAKES["hyperstructure-rise"].path(stage.places())).then(() => (ended = true));
    await rollFrames(stage, speed, () => ended);
    expect(stage.status().hyperstructureProgress).toBe(100);
  });
});

describe("what is rolling", () => {
  it("stays the new take when it replaces one still playing, until the new one ends", async () => {
    const stage = stageOnBareLand();
    const { view, bridge } = bridgeOver(stage);
    const first = bridge.take("battle");
    const second = bridge.take("explore");
    await first;
    expect(view.setTake.mock.calls).toEqual([["battle"], ["explore"]]);
    await rollFrames(stage, 1, () => view.setTake.mock.calls.length > 2);
    await second;
    expect(view.setTake).toHaveBeenLastCalledWith(null);
  });

  it("is a path played from the keys, not idle, while it plays", async () => {
    const stage = stageOnBareLand();
    const { view, bridge } = bridgeOver(stage);
    void bridge.take("battle");
    const path = bridge.path({ keys: [{ t: 0 }, { t: 1, distance: 5 }] });
    await Promise.resolve();
    expect(view.setTake).toHaveBeenLastCalledWith("path");
    await rollFrames(stage, 1, () => view.setTake.mock.calls.at(-1)?.[0] === null);
    await path;
    expect(view.setTake.mock.calls).toEqual([["battle"], ["path"], [null]]);
  });

  it.each([
    ["reset", (bridge: ReturnType<typeof bridgeOver>["bridge"]) => bridge.reset()],
    ["stop", (bridge: ReturnType<typeof bridgeOver>["bridge"]) => bridge.stop()],
  ])("goes idle when the take is ended by %s", async (_, end) => {
    const stage = stageOnBareLand();
    const { view, bridge } = bridgeOver(stage);
    const take = bridge.take("realm-tiers");
    end(bridge);
    await take;
    expect(view.setTake.mock.calls).toEqual([["realm-tiers"], [null]]);
  });

  it("says nothing when the page leaves mid-take, or another world takes its place", async () => {
    const stage = stageOnBareLand();
    const { view, bridge } = bridgeOver(stage);
    const take = bridge.take("battle");
    stage.dispose();
    await expect(take).resolves.toBeUndefined();
    expect(view.setTake.mock.calls).toEqual([["battle"]]);
  });
});
