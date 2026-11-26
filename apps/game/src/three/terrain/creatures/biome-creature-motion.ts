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
export interface CreatureHunt {
  phase: "approach" | "stalk" | "charge" | "feed" | "spent" | "return";
  quarry: number;
  den: Cell;
  clock: number;
  sinceAim: number;
}

export type CreatureMood = "calm" | "wary" | "alarmed";

export interface RoamingCreature {
  id: number;
  species: CreatureSpecies;
  cell: Cell;
  target: Cell | null;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  turn: number;
  stride: number;
  lift: number;
  action: CreatureIdleAction;
  wait: number;
  steps: number;
  age: number;
  sinceSetOff: number;
  offset: Point;
  goal: Point;
  stopping: boolean;
  haste: number;
  mood: CreatureMood;
  blockedFor: number;
  stationSearchIn: number;
  gaze: number | null;
  leader: number | null;
  station: Point;
  young: boolean;
  hunt: CreatureHunt | null;
  hunger: number;
  caughtBy: number | null;
}

const REGION_SIZE = 8;

export function wildlifeRegion(cell: Cell): string {
  return `${Math.floor(cell.col / REGION_SIZE)}:${Math.floor(cell.row / REGION_SIZE)}`;
}

const SECONDS_TO_CRUISE = 0.5;
const SECONDS_TO_STOP = 0.25;
const ARRIVAL_DISTANCE = 0.35;
const ARRIVAL_PACE = 0.35;
const FACING_COSINE = 0.5;
const SECONDS_TO_CLIMB = 0.8;
const LANDING_DISTANCE = 0.5;

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

export function comeToRest(creature: RoamingCreature, dt: number): void {
  const traits = creatureTraits(creature.species);
  creature.speed = approach(creature.speed, 0, (traits.pace * creature.haste * dt) / SECONDS_TO_STOP);
  creature.turn = approach(creature.turn, 0, traits.agility * 8 * dt);
  creature.lift = approach(creature.lift, 0, dt / SECONDS_TO_CLIMB);
  if (creature.speed > 0) advance(creature, creature.speed * dt, dt);
}

export function setOff(creature: RoamingCreature, tile: Cell, spot: Point): void {
  creature.target = { col: tile.col, row: tile.row };
  creature.goal = offsetBetween(creature.cell, spot);
  creature.steps++;
  creature.sinceSetOff = 0;
  creature.haste = 1;
}

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
  const agility = traits.agility * (creature.haste > 1 ? 1.6 : 1);
  const wanted = clamp(bearingError * 4, -agility, agility);
  creature.turn = approach(creature.turn, wanted, agility * 8 * dt);
  creature.yaw = wrapAngle(creature.yaw + creature.turn * dt);
}

function advance(creature: RoamingCreature, step: number, dt: number): void {
  creature.offset.x += Math.sin(creature.yaw) * step;
  creature.offset.z += Math.cos(creature.yaw) * step;
  creature.stride += step + Math.abs(creature.turn) * dt * creatureTraits(creature.species).size * 0.3;
}

function facingShare(bearingError: number): number {
  return clamp((Math.cos(bearingError) - FACING_COSINE) / (0.9 - FACING_COSINE), 0, 1);
}

function arrivalShare(creature: RoamingCreature, remaining: number): number {
  return creature.stopping ? clamp(remaining / ARRIVAL_DISTANCE, ARRIVAL_PACE, 1) : 1;
}

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
