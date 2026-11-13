import { expeditionDepth, type ExpeditionRules } from "@bibliothecadao/eternum";
import { Vector3 } from "three";
import { claimCamera, type CameraClaim } from "./camera-moves";

/** A map tile as the contract places it. */
type MapHex = { col: number; row: number };

/** What the dive moves: the map's camera, its world, and a veil over the canvas. */
export interface SpireDiveStage {
  /** The camera's position and the point it looks at now. */
  pose(): { position: Vector3; target: Vector3 };
  /** Moves the camera to a pose over `seconds`, resolving once it is there. */
  fly(position: Vector3, target: Vector3, seconds: number, ease: string): Promise<void>;
  /** Puts the camera at a pose at once. */
  place(position: Vector3, target: Vector3): void;
  /** Moves the camera onto a tile at once, keeping its angle and distance, the world drawn around it (or soon after). */
  cutTo(hex: MapHex): Promise<void>;
  /** A tile's point in the world as it is drawn now. */
  pointOf(hex: MapHex): Vector3;
  /** Fades the veil over the canvas to `opacity` over `ms`, resolving once it is there. */
  veil(opacity: number, ms: number): Promise<void>;
  /** The scene's own camera work stands down while the dive flies into the spire, until the returned call. */
  hold(): () => void;
}

/** Where a view through a spire passes: down, into the spire, out at the arrival; up, out of the spire, to it. */
export interface SpireCrossing {
  spire: MapHex;
  arrival: MapHex;
  down: boolean;
}

/** A dive under way. */
export interface SpireDive {
  /** Settles as the dive ends: true once the camera has landed over its arrival, false if it was cancelled first. */
  readonly done: Promise<boolean>;
  /**
   * Ends the dive where it is, for a newer writer of the camera or the map's exit: its own camera move stops, the
   * canvas shows again and its hold is handed back at once, and it writes neither camera nor canvas after.
   */
  cancel(): void;
}

/** How far into the spire the camera flies: a share of its distance from the point it looks at. */
const INSIDE = 0.08;
const DIVE_SECONDS = 0.7;
const EMERGE_SECONDS = 0.8;
/** The veil closes over the dive's last stretch, inside the spire, and opens as the camera emerges. */
const VEIL_CLOSE_MS = 350;
const VEIL_OPEN_MS = 450;

/**
 * The view's way between two layers of a region: down, into the spot the camera looks at in the layer left (the spire
 * itself when the view goes through one); up, out of the spot it reaches. A layer holds no spire until a realm finds
 * one there, so the view dives where it stands; the only move between regions is the cut under the veil.
 */
export function spireCrossing(rules: ExpeditionRules, from: MapHex, to: MapHex): SpireCrossing {
  const down = expeditionDepth(rules, { y: to.row }) > expeditionDepth(rules, { y: from.row });
  return { spire: down ? from : to, arrival: to, down };
}

/**
 * The view through a spire, as a descent and an ascent (owner, 4 November 2026: "the camera dives toward the spire !!
 * like we go inside it"). Going down, the camera flies into the spire and the veil closes inside it; the map's jump to
 * the layer is cut while it is closed, and the camera emerges over its arrival. Going up, the reverse: the camera sinks
 * into the ground where it looks, and emerges out of the spire, settling over its arrival. With reduced motion, the veil
 * alone covers the cut.
 *
 * The dive claims the shared camera (keyed by its controls) and writes it only through its stage, which `stageFor`
 * builds on that claim: the next writer from outside (another scene's flight, a selection, a newer view's dive) takes
 * the camera and cancels the dive.
 */
export function diveThroughSpire(
  camera: object,
  stageFor: (claim: CameraClaim) => SpireDiveStage,
  crossing: SpireCrossing,
  reducedMotion: boolean,
): SpireDive {
  let taken = () => {};
  const claim = claimCamera(camera, () => taken());
  const stage = stageFor(claim);
  const run = new DiveRun(stage, claim);
  taken = () => run.cancel();
  const done = run.settle(
    reducedMotion ? cutUnderVeil(stage, run, crossing.arrival) : passThrough(stage, run, crossing),
  );
  return { done, cancel: () => run.cancel() };
}

async function passThrough(stage: SpireDiveStage, run: DiveRun, { spire, arrival, down }: SpireCrossing) {
  const { position, target } = stage.pose();
  const offset = position.clone().sub(target);
  await sinkInto(stage, run, down ? stage.pointOf(spire) : target, offset);
  // Under the closed veil the camera stands back at its distance and goes back to the map, which draws the layer for
  // the view it lands on and keeps drawing it as the camera emerges.
  const inside = stage.pose().target;
  stage.place(inside.clone().add(offset), inside);
  run.handBack();
  await run.until(stage.cutTo(down ? arrival : spire));
  const from = stage.pose().target;
  stage.place(from.clone().add(offset.clone().multiplyScalar(INSIDE)), from);
  const landing = down ? from : stage.pointOf(arrival);
  await run.until(
    Promise.all([
      stage.veil(0, VEIL_OPEN_MS),
      stage.fly(landing.clone().add(offset), landing, EMERGE_SECONDS, "power2.out"),
    ]),
  );
}

/** The camera flies into a point, the veil closing over the last stretch. */
async function sinkInto(stage: SpireDiveStage, run: DiveRun, point: Vector3, offset: Vector3): Promise<void> {
  const inside = point.clone().add(offset.clone().multiplyScalar(INSIDE));
  const fly = stage.fly(inside, point, DIVE_SECONDS, "power2.in");
  await run.until(wait(DIVE_SECONDS * 1000 - VEIL_CLOSE_MS));
  await run.until(Promise.all([fly, stage.veil(1, VEIL_CLOSE_MS)]));
}

async function cutUnderVeil(stage: SpireDiveStage, run: DiveRun, arrival: MapHex): Promise<void> {
  await run.until(stage.veil(1, VEIL_CLOSE_MS));
  run.handBack();
  await run.until(stage.cutTo(arrival));
  await run.until(stage.veil(0, VEIL_OPEN_MS));
}

class DiveCancelled extends Error {}

/**
 * A dive's lifetime: it holds the scene's camera work from its start and the camera's claim to its end, and a cancel
 * ends every wait of the dive.
 */
class DiveRun {
  private cancelled = false;
  private endWaits: (reason: DiveCancelled) => void = () => {};
  private readonly ended = new Promise<never>((_, reject) => (this.endWaits = reject));
  private handBackHold: (() => void) | null;

  constructor(
    private readonly stage: SpireDiveStage,
    private readonly claim: CameraClaim,
  ) {
    this.ended.catch(() => {});
    this.handBackHold = stage.hold();
  }

  /** Waits for a piece of the dive's work, unless the dive is cancelled first, which ends it there. */
  async until<T>(work: Promise<T>): Promise<T> {
    const value = await Promise.race([work, this.ended]);
    if (this.cancelled) throw new DiveCancelled();
    return value;
  }

  /** The scene takes its camera work back. */
  handBack(): void {
    this.handBackHold?.();
    this.handBackHold = null;
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.endWaits(new DiveCancelled());
    this.restore();
  }

  /** The dive's outcome: landed, or cancelled; any other failure gives the camera and the canvas back, and is thrown. */
  async settle(dive: Promise<void>): Promise<boolean> {
    try {
      await dive;
      this.claim.end();
      return true;
    } catch (error) {
      if (this.cancelled) return false;
      this.restore();
      throw error;
    }
  }

  private restore(): void {
    this.claim.end();
    this.handBack();
    void this.stage.veil(0, 0);
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The veil a dive closes over the map: the map's canvas (#main-canvas) fading to the page's black behind it, so the HUD
 * over it is never dimmed.
 */
export function createSpireVeil(): (opacity: number, ms: number) => Promise<void> {
  return (opacity, ms) => {
    const canvas = document.getElementById("main-canvas");
    if (canvas)
      Object.assign(canvas.style, { transition: `opacity ${ms}ms ease-in-out`, opacity: String(1 - opacity) });
    return wait(ms);
  };
}
