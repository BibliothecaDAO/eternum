import { Vector3 } from "three";

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
  /** While the dive flies into the spire, the scene's own camera work stands down; it takes the camera back at the cut. */
  hold(held: boolean): void;
}

/** How far into the spire the camera flies: a share of its distance from the point it looks at. */
const INSIDE = 0.08;
const DIVE_SECONDS = 0.7;
const EMERGE_SECONDS = 0.8;
/** The veil closes over the dive's last stretch, inside the spire, and opens as the camera emerges. */
const VEIL_CLOSE_MS = 350;
const VEIL_OPEN_MS = 450;

/**
 * The view through a spire, as a descent and an ascent (owner, 4 November 2026: "the camera dives toward the spire !!
 * like we go inside it"). Going down, the camera flies into the spire and the veil closes inside it; the map's jump to
 * the layer is cut while it is closed, and the camera emerges over its arrival. Going up, the reverse: the camera sinks
 * into the ground where it looks, and emerges out of the spire, settling over its arrival. With reduced motion, the veil
 * alone covers the cut.
 */
export async function diveThroughSpire(
  stage: SpireDiveStage,
  { spire, arrival, down, reducedMotion }: { spire: MapHex; arrival: MapHex; down: boolean; reducedMotion: boolean },
): Promise<void> {
  let held = true;
  const release = () => {
    if (held) stage.hold(false);
    held = false;
  };
  stage.hold(true);
  try {
    if (reducedMotion) return await cutUnderVeil(stage, arrival);
    const { position, target } = stage.pose();
    const offset = position.clone().sub(target);
    await sinkInto(stage, down ? stage.pointOf(spire) : target, offset);
    // Under the closed veil the camera stands back at its distance and goes back to the map, which draws the layer for
    // the view it lands on and keeps drawing it as the camera emerges.
    const inside = stage.pose().target;
    stage.place(inside.clone().add(offset), inside);
    release();
    await stage.cutTo(down ? arrival : spire);
    const from = stage.pose().target;
    stage.place(from.clone().add(offset.clone().multiplyScalar(INSIDE)), from);
    const landing = down ? from : stage.pointOf(arrival);
    await Promise.all([
      stage.veil(0, VEIL_OPEN_MS),
      stage.fly(landing.clone().add(offset), landing, EMERGE_SECONDS, "power2.out"),
    ]);
  } finally {
    release();
    await stage.veil(0, 0);
  }
}

/** The camera flies into a point, the veil closing over the last stretch. */
async function sinkInto(stage: SpireDiveStage, point: Vector3, offset: Vector3): Promise<void> {
  const inside = point.clone().add(offset.clone().multiplyScalar(INSIDE));
  const fly = stage.fly(inside, point, DIVE_SECONDS, "power2.in");
  await wait(DIVE_SECONDS * 1000 - VEIL_CLOSE_MS);
  await Promise.all([fly, stage.veil(1, VEIL_CLOSE_MS)]);
}

async function cutUnderVeil(stage: SpireDiveStage, arrival: MapHex): Promise<void> {
  await stage.veil(1, VEIL_CLOSE_MS);
  await stage.cutTo(arrival);
  await stage.veil(0, VEIL_OPEN_MS);
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
