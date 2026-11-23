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

export interface HuntingGround {
  creatures: ReadonlyMap<number, RoamingCreature>;
  canStand(tile: Cell, species: CreatureSpecies): boolean;
  isPathClear(from: Point, to: Point, species: CreatureSpecies): boolean;
  tilesBeside(creature: RoamingCreature): Cell[];
  spotOn(tile: Cell): Point;
  remove(id: number): void;
  regroup(): void;
}

const STALK_DISTANCE = 4.8;
const CHARGE_DISTANCE = 1.9;
const CATCH_DISTANCE = 0.34;
const APPROACH_HASTE = 1.4;
const PATIENCE_SECONDS = 60;
const STALK_STEALTH = 1.7;
const AIM_SECONDS = 0.3;
const STRAGGLER_REACH = 3;
const SPENT_SECONDS = 4;
const FEED_SECONDS = 10;
const HUNGER_AFTER_MISS = [40, 70] as const;
const HUNGER_AFTER_KILL = [240, 420] as const;
const HUNGER_RECHECK_SECONDS = 10;
export const FIRST_HUNGER = [20, 60] as const;

export function fears(animal: RoamingCreature, hunter: RoamingCreature): boolean {
  const game = creatureTraits(hunter.species).hunts?.game;
  return game !== undefined && creatureTraits(animal.species).prey === game && hunter.caughtBy === null;
}

export function stealthOf(hunter: RoamingCreature): number {
  return hunter.hunt?.phase === "stalk" ? STALK_STEALTH : 1;
}

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

export function pursueHunt(hunter: RoamingCreature, dt: number, ground: HuntingGround): void {
  const hunt = hunter.hunt!;
  hunt.clock += dt;
  hunt.sinceAim += dt;
  const quarry = ground.creatures.get(hunt.quarry);
  if (hunt.phase === "return") return goHome(hunter, hunt, ground);
  if (hunt.phase === "feed") return feed(hunter, hunt, quarry, ground);
  if (hunt.phase === "spent") return standSpent(hunter, hunt, quarry);
  const scent = creatureTraits(hunter.species).hunts!.scent;
  if (!quarry || quarry.caughtBy !== null || apart(hunter, quarry) > scent * 1.4) return turnHome(hunter, hunt);
  if (hunt.phase === "charge") charge(hunter, hunt, quarry, ground);
  else closeIn(hunter, hunt, quarry, ground);
}

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
  if (!next) return turnHome(hunter, hunt);
  setOff(hunter, next, ground.spotOn(next));
  hunter.haste = hunt.phase === "approach" ? APPROACH_HASTE : 1;
  hunter.stopping = false;
}

function charge(hunter: RoamingCreature, hunt: CreatureHunt, marked: RoamingCreature, ground: HuntingGround): void {
  const quarry = nearestGame(hunter, ground, STRAGGLER_REACH) ?? marked;
  hunt.quarry = quarry.id;
  if (apart(hunter, quarry) < CATCH_DISTANCE) return bringDown(hunter, hunt, quarry, ground);
  if (hunt.clock > creatureTraits(hunter.species).hunts!.stamina) {
    stopWhereItIs(hunter, ground);
    return enter(hunt, "spent");
  }
  if (hunt.sinceAim >= AIM_SECONDS || !hunter.target) takeAim(hunter, hunt, quarry, ground);
}

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

function standSpent(hunter: RoamingCreature, hunt: CreatureHunt, quarry: RoamingCreature | undefined): void {
  hunter.action = "watch";
  hunter.gaze = quarry ? bearingTo(hunter, quarry) : null;
  if (hunt.clock > SPENT_SECONDS) turnHome(hunter, hunt);
}

function turnHome(hunter: RoamingCreature, hunt: CreatureHunt): void {
  hunter.hunger = hungerAfter(hunter, HUNGER_AFTER_MISS);
  enter(hunt, "return");
}

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

function stopWhereItIs(creature: RoamingCreature, ground: HuntingGround): void {
  const under = findNearestTerrainHex(creature.x, creature.z);
  moveOntoTile(creature, ground.canStand(under, creature.species) ? under : creature.cell);
  creature.haste = 1;
}

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

function tileNearer(hunter: RoamingCreature, point: Point, ground: HuntingGround): Cell | undefined {
  const here = apart(hunter, point);
  return ground
    .tilesBeside(hunter)
    .map((tile) => ({ tile, distance: apart(ground.spotOn(tile), point) }))
    .filter(({ distance }) => distance < here - 0.1)
    .toSorted((a, b) => a.distance - b.distance)
    .find(({ tile }) => ground.isPathClear(hunter, ground.spotOn(tile), hunter.species))?.tile;
}

function hungerAfter(hunter: RoamingCreature, [least, most]: readonly [number, number]): number {
  return least + ((hunter.id * 0.618034 + hunter.steps * 0.137) % 1) * (most - least);
}

function apart(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
