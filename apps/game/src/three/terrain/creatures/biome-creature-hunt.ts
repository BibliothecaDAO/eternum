import { findNearestTerrainHex } from "../terrain-coordinates";
import { creatureTraits, type CreatureSpecies } from "./biome-creature-catalog";
import {
  bearingTo,
  moveOntoTile,
  setOff,
  wildlifeRegion,
  type Cell,
  type CreatureHunt,
  type Point,
  type RoamingCreature,
} from "./biome-creature-motion";

/** What a hunt asks of the ground it runs over; the population answers. */
export interface HuntingGround {
  creatures: ReadonlyMap<number, RoamingCreature>;
  canStand(tile: Cell, species: CreatureSpecies): boolean;
  isPathClear(from: Point, to: Point, species: CreatureSpecies): boolean;
  /** The tiles beside an animal that its kind may stand on. */
  tilesBeside(creature: RoamingCreature): Cell[];
  spotOn(tile: Cell): Point;
  /** Takes an animal off the map. */
  remove(id: number): void;
  /** Lets a herd that lost its leader follow another. */
  regroup(): void;
}

/**
 * How near its quarry a hunter comes in the open before it drops to a stalk, how near it creeps before it charges,
 * and how near it must get to bring it down.
 */
const STALK_DISTANCE = 4.8;
const CHARGE_DISTANCE = 1.9;
const CATCH_DISTANCE = 0.34;
/** It closes the open ground briskly; a hunter that has not got nearer in this many seconds lets the quarry go. */
const APPROACH_HASTE = 1.4;
const PATIENCE_SECONDS = 60;
/** A stalking hunter is not seen until it is this many times nearer than one in the open. */
const STALK_STEALTH = 1.7;
/** In the charge it takes aim again this often, at whichever of its game is then nearest within this reach. */
const AIM_SECONDS = 0.3;
const STRAGGLER_REACH = 3;
/** Seconds it stands blown after a miss, and feeds after a kill. */
const SPENT_SECONDS = 4;
const FEED_SECONDS = 10;
/** Seconds before it hunts again: after a miss, after a kill, and before it looks again when no game is near. */
const HUNGER_AFTER_MISS = [40, 70] as const;
const HUNGER_AFTER_KILL = [240, 420] as const;
const HUNGER_RECHECK_SECONDS = 10;
/** Seconds before a new hunter's first hunt. */
export const FIRST_HUNGER = [20, 60] as const;

/** Whether `animal` fears `hunter`: it is the game that hunter takes. */
export function fears(animal: RoamingCreature, hunter: RoamingCreature): boolean {
  const game = creatureTraits(hunter.species).hunts?.game;
  return game !== undefined && creatureTraits(animal.species).prey === game && hunter.caughtBy === null;
}

/** How many times further off a hunter seems to its prey than it is: a stalking one goes unseen until it is close. */
export function stealthOf(hunter: RoamingCreature): number {
  return hunter.hunt?.phase === "stalk" ? STALK_STEALTH : 1;
}

/** A hunter at ease and hungry marks the nearest of its game and starts to stalk it. Returns whether a hunt began. */
export function beginHuntIfHungry(hunter: RoamingCreature, ground: HuntingGround): boolean {
  const hunts = creatureTraits(hunter.species).hunts;
  if (!hunts || hunter.hunger > 0) return false;
  const quarry = nearestGame(hunter, ground, hunts.scent);
  if (!quarry) {
    hunter.hunger = HUNGER_RECHECK_SECONDS;
    return false;
  }
  hunter.hunt = { phase: "approach", quarry: quarry.id, den: { ...hunter.cell }, clock: 0, sinceAim: 0 };
  return true;
}

/** Carries a hunt one frame on: stalk, charge, the kill or the miss, and the walk home. */
export function pursueHunt(hunter: RoamingCreature, dt: number, ground: HuntingGround): void {
  const hunt = hunter.hunt!;
  hunt.clock += dt;
  hunt.sinceAim += dt;
  const quarry = ground.creatures.get(hunt.quarry);
  if (hunt.phase === "return") return goHome(hunter, hunt, ground);
  if (hunt.phase === "feed") return feed(hunter, hunt, quarry, ground);
  if (hunt.phase === "spent") return standSpent(hunter, hunt, quarry);
  const scent = creatureTraits(hunter.species).hunts!.scent;
  // The quarry is gone, another hunter's, or clean away.
  if (!quarry || quarry.caughtBy !== null || apart(hunter, quarry) > scent * 1.4) return turnHome(hunter, hunt);
  if (hunt.phase === "charge") charge(hunter, hunt, quarry, ground);
  else closeIn(hunter, hunt, quarry, ground);
}

/**
 * Closes on the quarry tile by tile: in the open while it is far, low and at a walk once it might be seen, until it is
 * near enough, with a clear run, to charge.
 */
function closeIn(hunter: RoamingCreature, hunt: CreatureHunt, quarry: RoamingCreature, ground: HuntingGround): void {
  const away = apart(hunter, quarry);
  if (away < CHARGE_DISTANCE && ground.isPathClear(hunter, quarry, hunter.species)) {
    enter(hunt, "charge");
    return charge(hunter, hunt, quarry, ground);
  }
  if (hunt.phase === "approach" && away < STALK_DISTANCE) enter(hunt, "stalk");
  if (hunt.clock > PATIENCE_SECONDS) return turnHome(hunter, hunt);
  if (hunter.target || hunter.blockedFor > 0) return;
  const next = tileNearer(hunter, quarry, ground);
  // No way closer: the hunt is over.
  if (!next) return turnHome(hunter, hunt);
  setOff(hunter, next, ground.spotOn(next));
  hunter.haste = hunt.phase === "approach" ? APPROACH_HASTE : 1;
  hunter.stopping = false;
}

/** Runs the nearest of its game down, taking fresh aim as it turns, until it has it or is blown. */
function charge(hunter: RoamingCreature, hunt: CreatureHunt, marked: RoamingCreature, ground: HuntingGround): void {
  // A charge goes for whichever animal is now nearest: the straggler, not the one it marked.
  const quarry = nearestGame(hunter, ground, STRAGGLER_REACH) ?? marked;
  hunt.quarry = quarry.id;
  if (apart(hunter, quarry) < CATCH_DISTANCE) return bringDown(hunter, hunt, quarry, ground);
  if (hunt.clock > creatureTraits(hunter.species).hunts!.stamina) {
    stopWhereItIs(hunter, ground);
    return enter(hunt, "spent");
  }
  if (hunt.sinceAim >= AIM_SECONDS || !hunter.target) takeAim(hunter, hunt, quarry, ground);
}

/** Heads straight for the quarry where the ground allows, else for the tile that brings it nearest. */
function takeAim(hunter: RoamingCreature, hunt: CreatureHunt, quarry: RoamingCreature, ground: HuntingGround): void {
  hunt.sinceAim = 0;
  stopWhereItIs(hunter, ground);
  const quarryTile = findNearestTerrainHex(quarry.x, quarry.z);
  if (ground.canStand(quarryTile, hunter.species) && ground.isPathClear(hunter, quarry, hunter.species)) {
    setOff(hunter, quarryTile, { x: quarry.x, z: quarry.z });
  } else {
    const next = tileNearer(hunter, quarry, ground);
    if (!next) return;
    setOff(hunter, next, ground.spotOn(next));
  }
  hunter.haste = creatureTraits(hunter.species).hunts!.dash;
  hunter.stopping = false;
}

function bringDown(hunter: RoamingCreature, hunt: CreatureHunt, quarry: RoamingCreature, ground: HuntingGround): void {
  quarry.caughtBy = hunter.id;
  quarry.action = "rest";
  quarry.mood = "calm";
  quarry.gaze = null;
  stopWhereItIs(quarry, ground);
  stopWhereItIs(hunter, ground);
  enter(hunt, "feed");
  ground.regroup();
}

function feed(
  hunter: RoamingCreature,
  hunt: CreatureHunt,
  quarry: RoamingCreature | undefined,
  ground: HuntingGround,
): void {
  hunter.action = "forage";
  if (quarry && hunt.clock <= FEED_SECONDS) return;
  if (quarry) ground.remove(quarry.id);
  hunter.hunger = hungerAfter(hunter, HUNGER_AFTER_KILL);
  enter(hunt, "return");
}

/** Blown after a miss, it stands and watches its quarry go. */
function standSpent(hunter: RoamingCreature, hunt: CreatureHunt, quarry: RoamingCreature | undefined): void {
  hunter.action = "watch";
  hunter.gaze = quarry ? bearingTo(hunter, quarry) : null;
  if (hunt.clock > SPENT_SECONDS) turnHome(hunter, hunt);
}

function turnHome(hunter: RoamingCreature, hunt: CreatureHunt): void {
  hunter.hunger = hungerAfter(hunter, HUNGER_AFTER_MISS);
  enter(hunt, "return");
}

/** Walks back to the region it left; the hunt is over once it stands there. */
function goHome(hunter: RoamingCreature, hunt: CreatureHunt, ground: HuntingGround): void {
  if (hunter.target || hunter.blockedFor > 0) return;
  hunter.haste = 1;
  if (wildlifeRegion(hunter.cell) === wildlifeRegion(hunt.den)) {
    hunter.hunt = null;
    hunter.wait = 1;
    return;
  }
  const next = tileNearer(hunter, ground.spotOn(hunt.den), ground);
  if (!next) {
    hunter.blockedFor = 2;
    return;
  }
  setOff(hunter, next, ground.spotOn(next));
  hunter.stopping = false;
}

function enter(hunt: CreatureHunt, phase: CreatureHunt["phase"]): void {
  hunt.phase = phase;
  hunt.clock = 0;
  hunt.sinceAim = AIM_SECONDS;
}

/** Ends an animal's walk on the tile it is over, keeping its place and its momentum. */
function stopWhereItIs(creature: RoamingCreature, ground: HuntingGround): void {
  const under = findNearestTerrainHex(creature.x, creature.z);
  moveOntoTile(creature, ground.canStand(under, creature.species) ? under : creature.cell);
  creature.haste = 1;
}

/** The nearest animal of the hunter's game still on its feet within `reach`. */
function nearestGame(hunter: RoamingCreature, ground: HuntingGround, reach: number): RoamingCreature | undefined {
  let nearest: RoamingCreature | undefined;
  let least = reach;
  for (const animal of ground.creatures.values()) {
    if (animal.caughtBy !== null || !fears(animal, hunter)) continue;
    const distance = apart(hunter, animal);
    if (distance < least) [nearest, least] = [animal, distance];
  }
  return nearest;
}

/** The tile beside the hunter, reachable from where it stands, that brings it nearest `point`. */
function tileNearer(hunter: RoamingCreature, point: Point, ground: HuntingGround): Cell | undefined {
  const here = apart(hunter, point);
  return ground
    .tilesBeside(hunter)
    .map((tile) => ({ tile, distance: apart(ground.spotOn(tile), point) }))
    .filter(({ distance }) => distance < here - 0.1)
    .toSorted((a, b) => a.distance - b.distance)
    .find(({ tile }) => ground.isPathClear(hunter, ground.spotOn(tile), hunter.species))?.tile;
}

/** Seconds until it hunts again, somewhere in `range`: no two hunters, and no two hunts, the same. */
function hungerAfter(hunter: RoamingCreature, [least, most]: readonly [number, number]): number {
  return least + ((hunter.id * 0.618034 + hunter.steps * 0.137) % 1) * (most - least);
}

function apart(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
