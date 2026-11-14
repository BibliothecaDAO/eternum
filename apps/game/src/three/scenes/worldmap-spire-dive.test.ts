import { regionSpire, viewInLayer, type ExpeditionRules } from "@bibliothecadao/eternum";
import { Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { endCameraMove, startCameraMove, stopCameraMove, type CameraClaim } from "./camera-moves";
import { diveThroughSpire, spireCrossing, type SpireCrossing, type SpireDiveStage } from "./worldmap-spire-dive";

type Hex = { col: number; row: number };

// A flat world: a tile (col, row) is drawn at (col, 0, row); the camera looks from 10 up and 10 back.
const OFFSET = new Vector3(0, 10, 10);
const at = (hex: Hex) => new Vector3(hex.col, 0, hex.row);
const SPIRE = { col: 5, row: 5 };
const SURFACE = { col: 7, row: 7 };
const ETHEREAL = { col: 7, row: 107 };
const DISTANCE = Math.round(OFFSET.length() * 10) / 10;
const INSIDE = Math.round(OFFSET.length() * 0.08 * 10) / 10;

/**
 * A scene around the shared camera, as the map writes it: a flight stands as the camera's move under way until it lands
 * (cameraAnimate), and every other write stops the move under way first (placeCamera). The canvas shows under the veil.
 */
function sceneAround(start: Hex, { cutMs = 0 } = {}) {
  const camera = {};
  let position = at(start).add(OFFSET);
  let target = at(start);
  let veil = 0;
  let holds = 0;
  const steps: string[] = [];
  const log = (verb: string, nextPosition: Vector3, nextTarget: Vector3) =>
    steps.push(
      `${verb} ${nextTarget.x},${nextTarget.z} at ${Math.round(nextPosition.distanceTo(nextTarget) * 10) / 10}`,
    );
  const put = (nextPosition: Vector3, nextTarget: Vector3) => {
    [position, target] = [nextPosition.clone(), nextTarget.clone()];
  };
  const stageFor = (claim: CameraClaim): SpireDiveStage => ({
    pose: () => ({ position: position.clone(), target: target.clone() }),
    fly: (nextPosition, nextTarget, seconds) =>
      new Promise((resolve) =>
        claim.move(() => {
          stopCameraMove(camera);
          log("fly", nextPosition, nextTarget);
          const landing = setTimeout(() => {
            endCameraMove(camera, cancel);
            put(nextPosition, nextTarget);
            resolve();
          }, seconds * 1000);
          const cancel = () => clearTimeout(landing);
          startCameraMove(camera, cancel);
        }),
      ),
    place: (nextPosition, nextTarget) =>
      claim.move(() => {
        stopCameraMove(camera);
        log("place", nextPosition, nextTarget);
        put(nextPosition, nextTarget);
      }),
    cutTo: (hex) =>
      new Promise((resolve) =>
        claim.move(() => {
          stopCameraMove(camera);
          steps.push(`cut ${hex.col},${hex.row}`);
          put(at(hex).add(position.clone().sub(target)), at(hex));
          setTimeout(resolve, cutMs);
        }),
      ),
    pointOf: at,
    veil: (opacity, ms) => {
      veil = opacity;
      steps.push(ms > 0 ? `veil ${opacity}` : `veil ${opacity} at once`);
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    hold: () => {
      holds += 1;
      steps.push("hold");
      return () => {
        holds -= 1;
        steps.push("release");
      };
    },
  });
  return {
    steps,
    dive: (crossing: SpireCrossing, reducedMotion = false) =>
      diveThroughSpire(camera, stageFor, crossing, reducedMotion),
    /** Another writer of the camera, as the realm's flight out or a selection's move: it stops the move under way. */
    lookElsewhere: (hex: Hex) => {
      stopCameraMove(camera);
      put(at(hex).add(OFFSET), at(hex));
    },
    looksAt: () => ({ col: target.x, row: target.z }),
    distance: () => Math.round(position.distanceTo(target) * 10) / 10,
    canvasShown: () => veil === 0,
    held: () => holds > 0,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const landed = async (done: Promise<boolean>) => {
  await vi.runAllTimersAsync();
  return done;
};

describe("the view through a spire", () => {
  it("going down, flies into the spire, cuts under the veil, and emerges over the arrival", async () => {
    const scene = sceneAround(SURFACE);
    expect(await landed(scene.dive({ spire: SPIRE, arrival: ETHEREAL, down: true }).done)).toBe(true);
    expect(scene.steps).toEqual([
      "hold",
      `fly 5,5 at ${INSIDE}`,
      "veil 1",
      `place 5,5 at ${DISTANCE}`,
      "release",
      "cut 7,107",
      `place 7,107 at ${INSIDE}`,
      "veil 0",
      `fly 7,107 at ${DISTANCE}`,
    ]);
  });

  it("going up, sinks where it looks, and emerges out of the spire, settling over the arrival", async () => {
    const scene = sceneAround(ETHEREAL);
    expect(await landed(scene.dive({ spire: SPIRE, arrival: SURFACE, down: false }).done)).toBe(true);
    expect(scene.steps).toEqual([
      "hold",
      `fly 7,107 at ${INSIDE}`,
      "veil 1",
      `place 7,107 at ${DISTANCE}`,
      "release",
      "cut 5,5",
      `place 5,5 at ${INSIDE}`,
      "veil 0",
      `fly 7,7 at ${DISTANCE}`,
    ]);
  });

  it("with reduced motion, only the veil covers the cut", async () => {
    const scene = sceneAround(SURFACE);
    expect(await landed(scene.dive({ spire: SPIRE, arrival: ETHEREAL, down: true }, true).done)).toBe(true);
    expect(scene.steps).toEqual(["hold", "veil 1", "release", "cut 7,107", "veil 0"]);
  });
});

describe("a view through a spire between any two layers", () => {
  // Spacing 100: day 0's surface is rows 0..99, Ethereal I to III rows 100..399; day 1 starts at row 400.
  const rules: ExpeditionRules = {
    dayUnitSeconds: 14_400,
    spacing: 100,
    startMainAt: 0,
    scheduledEndAt: 1e9,
    endAt: 1e9,
    seed: 1n,
  };
  const region = (hex: Hex) => `${Math.floor(hex.col / rules.spacing)}:${Math.floor(hex.row / rules.spacing)}`;
  const layers = [0, 1, 2, 3] as const;
  const pairs = layers.flatMap((from) => layers.filter((to) => to !== from).map((to) => [from, to] as const));

  it.each(pairs)(
    "from layer %i to layer %i, every leg it shows stays inside one region",
    async (fromLayer, toLayer) => {
      for (const start of [
        { col: 137, row: 63 },
        { col: 412, row: 441 },
      ]) {
        const from = viewInLayer(rules, start, fromLayer);
        const to = viewInLayer(rules, start, toLayer);
        const scene = sceneAround(from);
        expect(await landed(scene.dive(spireCrossing(rules, from, to)).done)).toBe(true);

        // Replay the steps: a flight while the canvas shows must start and end in one region; a jump happens veiled.
        let looking = region(from);
        let veiled = false;
        for (const step of scene.steps) {
          const [verb, place] = step.split(" ");
          if (verb === "veil") veiled = place === "1";
          if (verb !== "fly" && verb !== "place" && verb !== "cut") continue;
          const [col, row] = place.split(",").map(Number);
          const next = region({ col, row });
          if (!veiled) expect({ step, from: looking, to: next }).toEqual({ step, from: looking, to: looking });
          looking = next;
        }
        expect(scene.looksAt()).toEqual(to);
        expect(region(scene.looksAt())).toBe(region(to));
      }
    },
  );

  it("dives into the surface spire from the surface, and comes out of it onto the surface", () => {
    const surface = { col: 137, row: 63 };
    const ethereal = viewInLayer(rules, surface, 2);
    expect(spireCrossing(rules, surface, ethereal)).toEqual({
      spire: regionSpire(rules, surface),
      arrival: ethereal,
      down: true,
    });
    expect(spireCrossing(rules, ethereal, surface)).toEqual({
      spire: regionSpire(rules, surface),
      arrival: surface,
      down: false,
    });
  });
});

describe("a view through a spire cut short", () => {
  const DOWN = { spire: SPIRE, arrival: ETHEREAL, down: true };
  const ELSEWHERE = { col: 40, row: 40 };

  it("leaves the camera to the realm view that takes it mid-dive, the canvas shown and nothing resumed", async () => {
    const scene = sceneAround(SURFACE);
    const dive = scene.dive(DOWN);
    await vi.advanceTimersByTimeAsync(500);
    const before = scene.steps.length;
    scene.lookElsewhere(ELSEWHERE);
    expect(scene.steps.slice(before)).toEqual(["release", "veil 0 at once"]);
    expect(await landed(dive.done)).toBe(false);
    expect(scene.steps.slice(before)).toEqual(["release", "veil 0 at once"]);
    expect(scene.looksAt()).toEqual(ELSEWHERE);
    expect(scene.distance()).toBe(DISTANCE);
    expect(scene.canvasShown()).toBe(true);
    expect(scene.held()).toBe(false);
  });

  it("leaves the camera to the realm view that takes it while the layer is drawn under the veil", async () => {
    const scene = sceneAround(SURFACE, { cutMs: 1_000 });
    const dive = scene.dive(DOWN);
    await vi.advanceTimersByTimeAsync(900);
    expect(scene.steps.at(-1)).toBe("cut 7,107");
    expect(scene.canvasShown()).toBe(false);
    scene.lookElsewhere(ELSEWHERE);
    expect(scene.canvasShown()).toBe(true);
    const written = scene.steps.length;
    expect(await landed(dive.done)).toBe(false);
    expect(scene.steps.slice(written)).toEqual([]);
    expect(scene.looksAt()).toEqual(ELSEWHERE);
    expect(scene.held()).toBe(false);
  });

  it("stops where it is when the map closes, its flight stopped, the canvas shown and the hold handed back", async () => {
    const scene = sceneAround(SURFACE);
    const dive = scene.dive(DOWN);
    await vi.advanceTimersByTimeAsync(500);
    dive.cancel();
    expect(scene.steps.slice(-2)).toEqual(["release", "veil 0 at once"]);
    const written = scene.steps.length;
    expect(await landed(dive.done)).toBe(false);
    expect(scene.steps.slice(written)).toEqual([]);
    expect(scene.looksAt()).toEqual(SURFACE);
    expect(scene.canvasShown()).toBe(true);
    expect(scene.held()).toBe(false);
  });

  it("gives way to a newer view's dive, which lands with the canvas shown", async () => {
    const scene = sceneAround(SURFACE);
    const first = scene.dive(DOWN);
    await vi.advanceTimersByTimeAsync(500);
    const deeper = { col: 7, row: 207 };
    const newer = scene.dive({ spire: SPIRE, arrival: deeper, down: true }, true);
    // The newer dive's veil closes at once: the first one's restored canvas came before it, not after.
    expect(scene.canvasShown()).toBe(false);
    expect(await landed(first.done)).toBe(false);
    expect(await newer.done).toBe(true);
    expect(scene.looksAt()).toEqual(deeper);
    expect(scene.canvasShown()).toBe(true);
    expect(scene.held()).toBe(false);
  });
});
