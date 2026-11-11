import { BiomeType } from "@bibliothecadao/types";

import { INSTANCE_FLOATS } from "./army-marches";
import type { GroundPoint } from "./map-camera";

/** The animals the map draws, by the names the renderer knows their models under. */
export const ANIMAL_SPECIES = [
  "arctic-fox",
  "bengal-tiger",
  "jackrabbit",
  "moose",
  "mountain-goat",
  "plains-zebra",
  "red-deer",
] as const;
export type AnimalSpecies = (typeof ANIMAL_SPECIES)[number];

type Game = "big" | "small";

/**
 * What each species is like. The sizes, paces, nerves, herds and hunts are those of the game's wildlife catalogue
 * (`three/terrain/creatures/biome-creature-catalog.ts` as pull request 5222 writes it), in world units and seconds.
 */
interface Traits {
  /** The biome it lives in. */
  biome: BiomeType;
  /** Its largest dimension on the map. */
  size: number;
  /** Its cruising speed, and its speed in flight as a multiple of it. */
  pace: number;
  sprint: number;
  /** How near danger comes before it runs. */
  nerve: number;
  /** How many keep company, fewest and most, and the chance one of them is this year's young. */
  herd?: readonly [number, number];
  young?: number;
  /** What kind of game it is to a hunter. */
  prey?: Game;
  /** A hunter: the game it takes, how far off it marks it, its charge as a multiple of its pace, and for how long. */
  hunts?: { game: Game; scent: number; dash: number; stamina: number };
}

const TRAITS: Record<AnimalSpecies, Traits> = {
  "arctic-fox": {
    biome: BiomeType.Tundra,
    size: 0.46,
    pace: 0.18,
    sprint: 2.8,
    nerve: 2.2,
    hunts: { game: "small", scent: 11, dash: 4.6, stamina: 6 },
  },
  "bengal-tiger": {
    biome: BiomeType.TropicalSeasonalForest,
    size: 1,
    pace: 0.17,
    sprint: 1,
    nerve: 2.2,
    hunts: { game: "big", scent: 13, dash: 5, stamina: 5 },
  },
  jackrabbit: { biome: BiomeType.TemperateDesert, size: 0.32, pace: 0.34, sprint: 2.2, nerve: 2.4, prey: "small" },
  moose: { biome: BiomeType.Taiga, size: 0.88, pace: 0.26, sprint: 2.4, nerve: 1.8, herd: [1, 2], young: 1 },
  "mountain-goat": {
    biome: BiomeType.Bare,
    size: 0.55,
    pace: 0.14,
    sprint: 2.6,
    nerve: 2,
    herd: [2, 3],
    young: 0.6,
    prey: "big",
  },
  "plains-zebra": {
    biome: BiomeType.Grassland,
    size: 0.72,
    pace: 0.22,
    sprint: 3,
    nerve: 2.4,
    herd: [3, 4],
    young: 0.6,
    prey: "big",
  },
  "red-deer": {
    biome: BiomeType.TemperateDeciduousForest,
    size: 0.77,
    pace: 0.22,
    sprint: 3.2,
    nerve: 2.6,
    herd: [2, 3],
    young: 0.5,
    prey: "big",
  },
};

/** The species at home in a biome, if the map draws one there. */
export function animalOf(biome: BiomeType): AnimalSpecies | null {
  return ANIMAL_SPECIES.find((species) => TRAITS[species].biome === biome) ?? null;
}

type Doing = "stands" | "grazes" | "rests" | "walks" | "flees" | "stalks" | "charges" | "feeds";

/** One animal: where its last move began and where it ends, since when, how fast, and what it is doing. */
export interface Animal {
  id: number;
  species: AnimalSpecies;
  /** The company it keeps: animals of one herd move as their leader does. */
  herd: number;
  young: boolean;
  from: GroundPoint;
  to: GroundPoint;
  setOff: number;
  speed: number;
  heading: number;
  doing: Doing;
  /** When it next decides what to do. */
  until: number;
  /** A hunter's quarry, and when it is next hungry. */
  quarry?: number;
  hungryAt: number;
}

/** How many animals the map holds at most: the game's own wildlife keeps to this many. */
export const MOST_ANIMALS = 32;
/** How far a frightened animal runs, and how far a herd wanders in one move. */
const FLIGHT = 4;
const WANDER = 2.2;
/** How near a hunter gets before it charges, how near it must come to catch, and how long it then feeds. */
const CHARGE_FROM = 1.3;
/** How much nearer a stalking hunter gets than a charging one before its game sees it. */
const STALKER_SEEN = 0.5;
const CATCH_WITHIN = 0.5;
const FEED_SECONDS = 14;
const FED_SECONDS = 90;
/** A young animal's size beside an adult's, and an animal's size beside the renderer's figure of it. */
const YOUNG_SIZE = 0.62;
const FIGURE_LENGTH = 1.4;
/** What an animal is and does, as the renderer's unit shader numbers them. */
const QUADRUPED = 3;
const MARCHES = 4;
const ACTIVITY: Record<Doing, number> = {
  stands: 1,
  grazes: 6,
  feeds: 6,
  rests: 7,
  walks: MARCHES,
  flees: MARCHES,
  stalks: MARCHES,
  charges: MARCHES,
};

const distance = (from: GroundPoint, to: GroundPoint) => Math.hypot(to.x - from.x, to.z - from.z);

/** Where an animal is at a moment of its move. */
export function animalAt(animal: Animal, seconds: number): GroundPoint {
  const length = distance(animal.from, animal.to);
  if (length < 1e-6 || animal.speed === 0) return animal.to;
  const gone = Math.min(Math.max((seconds - animal.setOff) * animal.speed, 0), length) / length;
  return {
    x: animal.from.x + (animal.to.x - animal.from.x) * gone,
    z: animal.from.z + (animal.to.z - animal.from.z) * gone,
  };
}

/**
 * The map's animals: herds that graze, rest and wander, run from armies and from hunters, and hunters that stalk,
 * charge, catch and feed. They are the map's own flourish and no fact of the game: nothing here is read by a rule,
 * and two viewers need not see the same animals. Every move is a straight walk the renderer's shader animates, so
 * the map tells the renderer only when an animal decides something new.
 */
export class Wildlife {
  private animals: Animal[] = [];
  private nextId = 1;

  /** `random` gives a number in [0, 1): a test hands in its own. */
  constructor(private readonly random: () => number = Math.random) {}

  /** Empties the map of animals and settles new ones on the homes given, a herd or a lone animal to each. */
  settle(homes: ReadonlyArray<{ at: GroundPoint; species: AnimalSpecies }>, seconds: number): void {
    this.animals = [];
    for (const [herd, home] of homes.entries()) {
      const traits = TRAITS[home.species];
      const [fewest, most] = traits.herd ?? [1, 1];
      const adults = fewest + Math.floor(this.random() * (most - fewest + 1));
      const withYoung = adults > 1 || traits.herd ? this.random() < (traits.young ?? 0) : false;
      for (let member = 0; member < adults + (withYoung ? 1 : 0); member += 1) {
        if (this.animals.length >= MOST_ANIMALS) return;
        const at = { x: home.at.x + (this.random() - 0.5) * 0.9, z: home.at.z + (this.random() - 0.5) * 0.9 };
        this.animals.push({
          id: this.nextId++,
          species: home.species,
          herd,
          young: member >= adults,
          from: at,
          to: at,
          setOff: seconds,
          speed: 0,
          heading: this.random() * Math.PI * 2,
          doing: "grazes",
          until: seconds + 2 + this.random() * 6,
          hungryAt: seconds + 20 + this.random() * 60,
        });
      }
    }
  }

  /** Every animal on the map, as it now is. */
  all(): readonly Animal[] {
    return this.animals;
  }

  /** The herd's leader: its eldest adult still alive, else whoever is left. None for a herd with nobody in it. */
  leaderOf(herd: number): Animal | undefined {
    const members = this.animals.filter((animal) => animal.herd === herd);
    return members.find((animal) => !animal.young) ?? members[0];
  }

  /**
   * Lets every animal act at a moment: hunters first, then the herds as the hunters left them, so a herd that lost
   * an animal to a hunter in this moment is led and frightened as the herd it now is. `threats` are where the
   * armies stand; `roams` tells whether a point is ground an animal may walk on.
   */
  update(seconds: number, threats: readonly GroundPoint[], roams: (point: GroundPoint) => boolean): void {
    for (const hunter of this.animals.filter((animal) => TRAITS[animal.species].hunts)) {
      this.hunt(hunter, seconds);
    }
    const herds = new Set(this.animals.map((animal) => animal.herd));
    for (const herd of herds) this.leadHerd(herd, seconds, threats, roams);
  }

  /** Every animal of one species as the renderer's instances. */
  instancesOf(species: AnimalSpecies): Float32Array {
    const drawn = this.animals.filter((animal) => animal.species === species);
    const floats = new Float32Array(drawn.length * INSTANCE_FLOATS);
    drawn.forEach((animal, index) => floats.set(instanceOf(animal), index * INSTANCE_FLOATS));
    return floats;
  }

  private hunt(hunter: Animal, seconds: number): void {
    const { hunts, pace } = TRAITS[hunter.species];
    if (!hunts || hunter.doing === "flees") return;
    const here = animalAt(hunter, seconds);
    if (hunter.doing === "feeds") {
      if (seconds >= hunter.until) hunter.hungryAt = seconds + FED_SECONDS;
      return;
    }
    const quarry = this.animals.find((animal) => animal.id === hunter.quarry);
    if (!quarry) {
      hunter.quarry = undefined;
      if (hunter.doing === "stalks" || hunter.doing === "charges") this.stop(hunter, here, seconds, "stands", 3);
      if (seconds < hunter.hungryAt) return;
      const marked = this.animals
        .filter((animal) => TRAITS[animal.species].prey === hunts.game)
        .map((animal) => ({ animal, far: distance(here, animalAt(animal, seconds)) }))
        .filter(({ far }) => far < hunts.scent)
        .toSorted((one, other) => one.far - other.far)[0];
      if (marked) hunter.quarry = marked.animal.id;
      return;
    }
    const there = animalAt(quarry, seconds);
    const far = distance(here, there);
    if (far < CATCH_WITHIN) {
      // The quarry is taken off the map in the moment it is caught, so it is never drawn after it.
      this.animals = this.animals.filter((animal) => animal !== quarry);
      hunter.quarry = undefined;
      this.stop(hunter, here, seconds, "feeds", FEED_SECONDS);
      return;
    }
    if (hunter.doing === "charges" && seconds >= hunter.until) {
      // Out of breath: the quarry gets away, and the hunter is no hungrier for a while.
      hunter.quarry = undefined;
      hunter.hungryAt = seconds + FED_SECONDS / 3;
      this.stop(hunter, here, seconds, "rests", 8);
      return;
    }
    const charges = hunter.doing === "charges" || far < CHARGE_FROM;
    if (charges && hunter.doing !== "charges") hunter.until = seconds + hunts.stamina;
    this.move(hunter, here, there, seconds, pace * (charges ? hunts.dash : 1.6), charges ? "charges" : "stalks");
  }

  private leadHerd(
    herd: number,
    seconds: number,
    threats: readonly GroundPoint[],
    roams: (point: GroundPoint) => boolean,
  ) {
    const leader = this.leaderOf(herd);
    if (!leader || TRAITS[leader.species].hunts) return this.idleHunter(leader, seconds, roams);
    const members = this.animals.filter((animal) => animal.herd === herd);
    const traits = TRAITS[leader.species];
    const here = animalAt(leader, seconds);
    const danger = this.dangerTo(leader, here, seconds, threats);
    if (danger && leader.doing !== "flees") {
      const away = Math.atan2(here.x - danger.x, here.z - danger.z);
      for (const member of members) {
        const from = animalAt(member, seconds);
        const spread = away + (this.random() - 0.5) * 0.5;
        const to = this.reachable(
          from,
          { x: from.x + Math.sin(spread) * FLIGHT, z: from.z + Math.cos(spread) * FLIGHT },
          roams,
        );
        this.move(member, from, to, seconds, traits.pace * traits.sprint, "flees");
        member.until = seconds + FLIGHT / (traits.pace * traits.sprint);
      }
      return;
    }
    if (seconds < leader.until) return;
    if (this.random() < 0.4) {
      const turn = this.random() * Math.PI * 2;
      const goal = this.reachable(
        here,
        { x: here.x + Math.sin(turn) * WANDER, z: here.z + Math.cos(turn) * WANDER },
        roams,
      );
      for (const member of members) {
        const from = animalAt(member, seconds);
        const beside =
          member === leader
            ? goal
            : { x: goal.x + (this.random() - 0.5) * 0.8, z: goal.z + (this.random() - 0.5) * 0.8 };
        this.move(member, from, roams(beside) ? beside : goal, seconds, traits.pace, "walks");
        member.until = seconds + distance(from, goal) / traits.pace + 1;
      }
      return;
    }
    for (const member of members) {
      const pick = this.random();
      this.stop(
        member,
        animalAt(member, seconds),
        seconds,
        pick < 0.65 ? "grazes" : pick < 0.85 ? "stands" : "rests",
        4 + this.random() * 6,
      );
    }
  }

  /** A hunter with no quarry and no hunger keeps to itself: it stands, rests, or walks on. */
  private idleHunter(hunter: Animal | undefined, seconds: number, roams: (point: GroundPoint) => boolean): void {
    if (!hunter || hunter.quarry !== undefined || hunter.doing === "feeds" || seconds < hunter.until) return;
    const here = animalAt(hunter, seconds);
    if (this.random() < 0.5) {
      const turn = this.random() * Math.PI * 2;
      const goal = this.reachable(
        here,
        { x: here.x + Math.sin(turn) * WANDER, z: here.z + Math.cos(turn) * WANDER },
        roams,
      );
      this.move(hunter, here, goal, seconds, TRAITS[hunter.species].pace, "walks");
      hunter.until = seconds + distance(here, goal) / TRAITS[hunter.species].pace + 1;
    } else {
      this.stop(hunter, here, seconds, this.random() < 0.6 ? "stands" : "rests", 3 + this.random() * 6);
    }
  }

  /** What an animal runs from, if anything is near enough: an army, or a hunter of its kind of game on the hunt. */
  private dangerTo(
    animal: Animal,
    here: GroundPoint,
    seconds: number,
    threats: readonly GroundPoint[],
  ): GroundPoint | null {
    const { nerve, prey } = TRAITS[animal.species];
    // A hunter that stalks is seen only from half as far as one that charges.
    const hunters = this.animals
      .filter((other) => other.quarry !== undefined && TRAITS[other.species].hunts?.game === prey)
      .map((other) => ({
        at: animalAt(other, seconds),
        seenFrom: other.doing === "charges" ? nerve : nerve * STALKER_SEEN,
      }));
    const armies = threats.map((threat) => ({ at: threat, seenFrom: nerve }));
    return [...armies, ...hunters].find((threat) => distance(here, threat.at) < threat.seenFrom)?.at ?? null;
  }

  /** The point toward `goal` an animal can walk to: the goal itself, or as far that way as the ground lets it. */
  private reachable(from: GroundPoint, goal: GroundPoint, roams: (point: GroundPoint) => boolean): GroundPoint {
    for (const share of [1, 0.75, 0.5, 0.25]) {
      const point = { x: from.x + (goal.x - from.x) * share, z: from.z + (goal.z - from.z) * share };
      if (roams(point)) return point;
    }
    return from;
  }

  private move(animal: Animal, from: GroundPoint, to: GroundPoint, seconds: number, speed: number, doing: Doing): void {
    animal.from = from;
    animal.to = to;
    animal.setOff = seconds;
    animal.speed = speed;
    animal.doing = doing;
    if (distance(from, to) > 1e-3) animal.heading = Math.atan2(to.x - from.x, to.z - from.z);
  }

  private stop(animal: Animal, at: GroundPoint, seconds: number, doing: Doing, forSeconds: number): void {
    this.move(animal, at, at, seconds, 0, doing);
    animal.until = seconds + forSeconds;
  }
}

function instanceOf(animal: Animal): number[] {
  const length = distance(animal.from, animal.to);
  // A move that goes nowhere is a stand: the shader reads a march of no length as one with no end.
  const activity = ACTIVITY[animal.doing] === MARCHES && length < 1e-3 ? ACTIVITY.stands : ACTIVITY[animal.doing];
  const size = (TRAITS[animal.species].size / FIGURE_LENGTH) * (animal.young ? YOUNG_SIZE : 1);
  const seed = Math.abs((Math.sin(animal.id * 12.9898) * 43758.5453) % 1);
  return [
    ...[animal.from.x, 0, animal.from.z, seed],
    ...[size, QUADRUPED, activity, animal.heading],
    ...[length, 0, animal.speed, animal.setOff],
    ...[1, 0, 0, 0],
    ...[1, 1, 1, 1],
  ];
}
