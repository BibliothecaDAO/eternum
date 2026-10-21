import type { StudioPath } from "./camera-path";
import type { StudioPlace } from "./fixture";
import type { StudioSubject } from "./stage";

type Places = Record<StudioPlace, [number, number, number]>;

interface StudioTake {
  label: string;
  /** What the take shows, in a line. */
  shot: string;
  /** What stands on the set while it rolls: its subjects and nothing else. */
  cast: readonly StudioSubject[];
  path: (places: Places) => StudioPath;
}

const above = ([x, y, z]: [number, number, number], height: number): [number, number, number] => [x, y + height, z];
const between = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
  (a[2] + b[2]) / 2,
];

/**
 * The studio's ready-made takes, in the docs lane's order of need (reports/lab-studio-shots.md). Each starts from the
 * world as it stood before any moment played, so a take replays the same; its cues land at the seconds written here.
 * Each films its action from the front, the south (`turn` near 0), where the map's camera stands and its structures face.
 */
export const STUDIO_TAKES = {
  "hyperstructure-rise": {
    label: "Hyperstructure rising",
    shot: "A low orbit round the foundation as the tower rises in four contributions, then a crane up as it completes.",
    cast: ["hyperstructure"],
    path: ({ hyperstructure }) => ({
      keys: [
        { t: 0, target: above(hyperstructure, 1.2), distance: 9, tilt: 74, turn: -35, fov: 30 },
        { t: 5.2, target: above(hyperstructure, 1.8), distance: 10, tilt: 70, turn: 5, ease: "in" },
        { t: 8, target: above(hyperstructure, 2.4), distance: 14, tilt: 58, turn: 15, ease: "out" },
      ],
      cues: [
        { at: 0.8, trigger: "rise", args: { progress: 30 } },
        { at: 2.2, trigger: "rise", args: { progress: 60 } },
        { at: 3.6, trigger: "rise", args: { progress: 90 } },
        { at: 5.2, trigger: "rise", args: { progress: 100 } },
      ],
    }),
  },
  battle: {
    label: "Battle up close",
    shot: "A low push-in on a long lens: the attacker strikes, the defender falls.",
    cast: ["battle"],
    path: ({ attacker, defender }) => ({
      keys: [
        { t: 0, target: above(between(attacker, defender), 0.5), distance: 15, tilt: 68, turn: -12, fov: 25 },
        { t: 5, distance: 9, turn: 4, ease: "out" },
      ],
      cues: [
        { at: 1, trigger: "attack" },
        { at: 3.4, trigger: "defeat" },
      ],
    }),
  },
  explore: {
    label: "Exploration",
    shot: "A crane down from high above, tracking the explorer as it uncovers three hexes of fog.",
    cast: ["explorer"],
    path: ({ exploreStart }) => ({
      keys: [
        { t: 0, target: exploreStart, distance: 34, tilt: 28, turn: 10, fov: 38 },
        { t: 6.4, target: [exploreStart[0] - 1, exploreStart[1], exploreStart[2] + 4.5], distance: 11, tilt: 58 },
      ],
      cues: [
        { at: 0.6, trigger: "explore" },
        { at: 2.4, trigger: "explore" },
        { at: 4.2, trigger: "explore" },
      ],
    }),
  },
  "realm-tiers": {
    label: "Realm through its tiers",
    shot: "A slow orbit on the realm as it grows from settlement to empire, a tier every 1.5 s.",
    cast: ["realm"],
    path: ({ realm }) => ({
      keys: [
        { t: 0, target: above(realm, 0.7), distance: 7.5, tilt: 64, turn: -12, fov: 30 },
        { t: 6, turn: 12, ease: "linear" },
      ],
      cues: [1.5, 3, 4.5].map((at, index) => ({ at, trigger: "realm", args: { level: index + 1 } })),
    }),
  },
  establisher: {
    label: "Wide establisher",
    shot: "A high crane pulling out over the whole set: realm, tower, armies and the fog's edge.",
    cast: ["realm", "hyperstructure", "battle", "explorer"],
    path: ({ realm, hyperstructure }) => ({
      keys: [
        { t: 0, target: above(realm, 0.5), distance: 12, tilt: 62, turn: -20, fov: 38 },
        { t: 8, target: between(realm, hyperstructure), distance: 40, tilt: 48, turn: 10 },
      ],
      cues: [{ at: 6.5, trigger: "strike" }],
    }),
  },
} satisfies Record<string, StudioTake>;

export const isStudioTake = (name: string | null): name is keyof typeof STUDIO_TAKES =>
  name !== null && Object.hasOwn(STUDIO_TAKES, name);
