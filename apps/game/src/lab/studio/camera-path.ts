/**
 * The studio camera, as a filmmaker reads it: what it looks at, how far, how high, from which side, through which lens.
 * A path is a list of such poses at given seconds; the camera eases from one to the next, so a take replays the same.
 */

/** Where the camera is, said around what it looks at. */
export interface StudioPose {
  /** The world point it looks at. */
  target: [x: number, y: number, z: number];
  /** From the target, in world units (a hex is about 2). */
  distance: number;
  /** Degrees from straight down (0) to the horizon (90). */
  tilt: number;
  /** Degrees around the target; 0 looks north (towards -z). Not wrapped, so 0 to 360 is a full orbit. */
  turn: number;
  /** Vertical field of view, degrees: about 25 is a long lens, 38 the game's own. */
  fov: number;
}

type Ease = "linear" | "in" | "out" | "inOut";

/** A pose at a second of the take. What it leaves out stays as the key before it set it. */
export interface StudioKey extends Partial<StudioPose> {
  t: number;
  /** How the camera arrives at this key from the one before: easing in and out by default. */
  ease?: Ease;
}

/** A moment the take plays at a second of its path, as `trigger(name, args)` would play it. */
interface StudioCue {
  at: number;
  trigger: string;
  args?: Record<string, unknown>;
}

export interface StudioPath {
  keys: StudioKey[];
  cues?: StudioCue[];
}

const MAX_TILT = 89;

const EASES: Record<Ease, (x: number) => number> = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - (1 - x) ** 3,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
};

/** The take's length: its last key or its last cue, whichever comes later. */
export const pathDuration = (path: StudioPath): number =>
  Math.max(0, ...path.keys.map((key) => key.t), ...(path.cues ?? []).map((cue) => cue.at));

/** The pose at `seconds` into the path, starting from `start` for whatever its first key leaves out. */
export function poseAt(path: StudioPath, seconds: number, start: StudioPose): StudioPose {
  const keys = completeKeys(path, start);
  if (keys.length === 0) return start;
  if (seconds <= keys[0].t) return keys[0].pose;
  for (let index = 1; index < keys.length; index += 1) {
    const to = keys[index];
    if (seconds > to.t) continue;
    const from = keys[index - 1];
    const span = to.t - from.t;
    const progress = span <= 0 ? 1 : EASES[to.ease]((seconds - from.t) / span);
    return blendPoses(from.pose, to.pose, progress);
  }
  return keys[keys.length - 1].pose;
}

/** Where the camera sits for a pose. */
export function cameraPosition(pose: StudioPose): [number, number, number] {
  const tilt = (clampTilt(pose.tilt) * Math.PI) / 180;
  const turn = (pose.turn * Math.PI) / 180;
  const [x, y, z] = pose.target;
  const ground = Math.sin(tilt) * pose.distance;
  return [x - Math.sin(turn) * ground, y + Math.cos(tilt) * pose.distance, z + Math.cos(turn) * ground];
}

/** The pose of a camera at `position` looking at `target`: the inverse of {@link cameraPosition}. */
export function poseFromCamera(
  position: readonly [number, number, number],
  target: readonly [number, number, number],
  fov: number,
): StudioPose {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const distance = Math.hypot(dx, dy, dz);
  const tilt = distance === 0 ? 0 : (Math.acos(Math.min(1, Math.max(-1, dy / distance))) * 180) / Math.PI;
  const turn = (Math.atan2(-dx, dz) * 180) / Math.PI;
  return { target: [target[0], target[1], target[2]], distance, tilt, turn, fov };
}

function completeKeys(path: StudioPath, start: StudioPose) {
  let previous = start;
  return path.keys
    .toSorted((a, b) => a.t - b.t)
    .map(({ t, ease = "inOut", ...pose }) => {
      previous = { ...previous, ...pose };
      return { t, ease, pose: previous };
    });
}

function blendPoses(from: StudioPose, to: StudioPose, progress: number): StudioPose {
  const mix = (a: number, b: number) => a + (b - a) * progress;
  return {
    target: [mix(from.target[0], to.target[0]), mix(from.target[1], to.target[1]), mix(from.target[2], to.target[2])],
    // A push-in or a pull-out reads even when the distance blends in ratio, not in steps.
    distance: from.distance * (to.distance / from.distance) ** progress,
    tilt: mix(from.tilt, to.tilt),
    turn: mix(from.turn, to.turn),
    fov: mix(from.fov, to.fov),
  };
}

const clampTilt = (tilt: number) => Math.min(MAX_TILT, Math.max(0, tilt));
