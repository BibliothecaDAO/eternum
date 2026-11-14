import { terrainHexToWorld } from "../terrain-coordinates";
import {
  creatureTraits,
  type CreatureIdleAction,
  type CreatureSpecies,
  type CreatureTraits,
} from "./biome-creature-catalog";

export interface Cell {
  col: number;
  row: number;
}
export interface Point {
  x: number;
  z: number;
}
/**
 * A hunt, from the hunter's side: it approaches its quarry in the open, stalks it from where it might be seen,
 * charges it, then feeds on it or stands spent, and goes home.
 * `den` is the tile it set out from: its herd's region stays held there until it is back.
 */
export interface CreatureHunt {
  phase: "approach" | "stalk" | "charge" | "feed" | "spent" | "return";
  quarry: number;
  den: Cell;
  /** Seconds in this phase, and since it last took aim. */
  clock: number;
  sinceAim: number;
}

/** How danger has an animal: at ease, watching it, or acting on its fright. */
export type CreatureMood = "calm" | "wary" | "alarmed";

export interface RoamingCreature {
  id: number;
  species: CreatureSpecies;
  /** The tile it belongs to, and the one it is walking to: both stay reserved until it arrives. */
  cell: Cell;
  target: Cell | null;
  /** Where it is, in world units, and the way it travels. */
  x: number;
  z: number;
  yaw: number;
  /** Its speed, in world units per second, and its turn, in radians per second. */
  speed: number;
  turn: number;
  /** The ground its legs have covered, turning on the spot included: its rig steps by this, never by the clock. */
  stride: number;
  /** How far off the ground a flier is, from 0 on its perch to 1 at cruising height. */
  lift: number;
  /** What it does while stopped. */
  action: CreatureIdleAction;
  wait: number;
  steps: number;
  /** Seconds it has lived, the clock of its bursts, and seconds since it last set off. */
  age: number;
  sinceSetOff: number;
  /** Its place and its walk's end, from its tile's centre: world offsets, so the map's origin can move under it. */
  offset: Point;
  goal: Point;
  /** Whether it stops at the tile it is walking to. */
  stopping: boolean;
  /** Its pace now, as a multiple of its walk: 1, or its sprint in flight. */
  haste: number;
  mood: CreatureMood;
  /** Seconds before it looks again for a way to go, after finding none. */
  blockedFor: number;
  /** The way to what it is watching, as a world bearing; null when nothing holds its eye. */
  gaze: number | null;
  /** The animal it keeps company with; null for one that leads its herd or lives alone. */
  leader: number | null;
  /** Where it keeps to beside its leader, as a world offset from the leader's spot. */
  station: Point;
  /** This year's young: smaller, and closer to its leader. */
  young: boolean;
  /** A hunter's hunt in progress, and the seconds until it is hungry enough for the next. */
  hunt: CreatureHunt | null;
  hunger: number;
  /** The hunter that brought it down; null for an animal still on its feet. */
  caughtBy: number | null;
}

/** The side, in tiles, of the square regions the map is cut into: one herd to each. */
const REGION_SIZE = 8;

export function wildlifeRegion(cell: Cell): string {
  return `${Math.floor(cell.col / REGION_SIZE)}:${Math.floor(cell.row / REGION_SIZE)}`;
}

/** Seconds to reach cruising speed, and to stop from it. */
const SECONDS_TO_CRUISE = 0.5;
const SECONDS_TO_STOP = 0.25;
/** A walk that ends in a stop slows over its last stretch, to this share of the pace. */
const ARRIVAL_DISTANCE = 0.35;
const ARRIVAL_PACE = 0.35;
/** An animal moves off only once it roughly faces its way: beyond this cosine it turns on the spot. */
const FACING_COSINE = 0.5;
/** Seconds a flier takes to climb to its height or come down, and how far from its perch it starts down. */
const SECONDS_TO_CLIMB = 0.8;
const LANDING_DISTANCE = 0.5;

/**
 * Steers toward the walk's end: turns first, moves off as it comes to face its way, and slows to a stop there.
 * Returns whether it arrived.
 */
export function walk(creature: RoamingCreature, dt: number): boolean {
  const traits = creatureTraits(creature.species);
  const goalX = creature.goal.x - creature.offset.x;
  const goalZ = creature.goal.z - creature.offset.z;
  const remaining = Math.hypot(goalX, goalZ);
  const bearingError = wrapAngle(Math.atan2(goalX, goalZ) - creature.yaw);
  turnToward(creature, bearingError, traits, dt);
  const pace = traits.pace * creature.haste;
  const cruise = pace * facingShare(bearingError) * arrivalShare(creature, remaining) * burstShare(creature);
  creature.speed = approach(creature.speed, cruise, (pace * dt) / SECONDS_TO_CRUISE);
  const flying = traits.movement === "air" && remaining > LANDING_DISTANCE && cruise > 0;
  creature.lift = approach(creature.lift, flying ? 1 : 0, dt / SECONDS_TO_CLIMB);
  const step = creature.speed * dt;
  if (remaining <= Math.max(step, 0.04)) {
    moveOntoTile(creature, creature.target!);
    return true;
  }
  advance(creature, step, dt);
  return false;
}

/** Lets a stopped animal's last momentum run out, so a walk never ends on a frozen frame. */
export function comeToRest(creature: RoamingCreature, dt: number): void {
  const traits = creatureTraits(creature.species);
  creature.speed = approach(creature.speed, 0, (traits.pace * creature.haste * dt) / SECONDS_TO_STOP);
  creature.turn = approach(creature.turn, 0, traits.agility * 8 * dt);
  creature.lift = approach(creature.lift, 0, dt / SECONDS_TO_CLIMB);
  if (creature.speed > 0) advance(creature, creature.speed * dt, dt);
}

/** Begins a walk to `spot` on `tile`, at its ordinary pace. */
export function setOff(creature: RoamingCreature, tile: Cell, spot: Point): void {
  creature.target = { col: tile.col, row: tile.row };
  creature.goal = offsetBetween(creature.cell, spot);
  creature.steps++;
  creature.sinceSetOff = 0;
  creature.haste = 1;
}

/** Makes `tile` the animal's own without moving it: its place is kept, counted from the new tile's centre. */
export function moveOntoTile(creature: RoamingCreature, tile: Cell): void {
  const tileStep = offsetBetween(creature.cell, terrainHexToWorld(tile.col, tile.row));
  creature.offset = { x: creature.offset.x - tileStep.x, z: creature.offset.z - tileStep.z };
  creature.cell = { col: tile.col, row: tile.row };
  creature.target = null;
  creature.goal = creature.offset;
}

export function placeInWorld(creature: RoamingCreature): void {
  const centre = terrainHexToWorld(creature.cell.col, creature.cell.row);
  creature.x = centre.x + creature.offset.x;
  creature.z = centre.z + creature.offset.z;
}

/** Where its walk ends, or where it stands when it is not walking. */
export function goalInWorld(creature: RoamingCreature): Point {
  const centre = terrainHexToWorld(creature.cell.col, creature.cell.row);
  return { x: centre.x + creature.goal.x, z: centre.z + creature.goal.z };
}

export function offsetBetween(cell: Cell, point: Point): Point {
  const centre = terrainHexToWorld(cell.col, cell.row);
  return { x: point.x - centre.x, z: point.z - centre.z };
}

export function bearingTo(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function turnToward(creature: RoamingCreature, bearingError: number, traits: CreatureTraits, dt: number): void {
  // An animal in flight wheels faster than one that ambles.
  const agility = traits.agility * (creature.haste > 1 ? 1.6 : 1);
  const wanted = clamp(bearingError * 4, -agility, agility);
  creature.turn = approach(creature.turn, wanted, agility * 8 * dt);
  creature.yaw = wrapAngle(creature.yaw + creature.turn * dt);
}

function advance(creature: RoamingCreature, step: number, dt: number): void {
  creature.offset.x += Math.sin(creature.yaw) * step;
  creature.offset.z += Math.cos(creature.yaw) * step;
  // A body turning on the spot still has to step round: its legs cover the arc its ends sweep.
  creature.stride += step + Math.abs(creature.turn) * dt * creatureTraits(creature.species).size * 0.3;
}

function facingShare(bearingError: number): number {
  return clamp((Math.cos(bearingError) - FACING_COSINE) / (0.9 - FACING_COSINE), 0, 1);
}

function arrivalShare(creature: RoamingCreature, remaining: number): number {
  return creature.stopping ? clamp(remaining / ARRIVAL_DISTANCE, ARRIVAL_PACE, 1) : 1;
}

/** Small animals cross open ground in runs and freezes; none freezes in flight. */
function burstShare(creature: RoamingCreature): number {
  const bursts = creatureTraits(creature.species).bursts;
  if (!bursts || creature.haste > 1) return 1;
  const [run, freeze] = bursts;
  return (creature.age + creature.id * 0.37) % (run + freeze) < run ? 1 : 0;
}

function approach(value: number, target: number, maxChange: number): number {
  return value + clamp(target - value, -maxChange, maxChange);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
