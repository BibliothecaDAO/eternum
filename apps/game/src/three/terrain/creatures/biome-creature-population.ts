import { terrainCellKey, terrainHexToWorld, terrainNeighborCoordinates } from "../terrain-coordinates";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "../terrain-hash";
import type { TerrainCellInput } from "../terrain-types";
import { isTerrainWaterBiome } from "../terrain-water";
import {
  creatureForBiome,
  creatureTraits,
  type CreatureIdleAction,
  type CreatureSpecies,
  type CreatureTraits,
} from "./biome-creature-catalog";

interface Cell {
  col: number;
  row: number;
}
interface Point {
  x: number;
  z: number;
}
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
  /** Seconds it has lived: the clock of its bursts. */
  age: number;
  /** Its place and its walk's end, from its tile's centre: world offsets, so the map's origin can move under it. */
  offset: Point;
  goal: Point;
  /** Whether it stops at the tile it is walking to. */
  stopping: boolean;
}

type PathCheck = (from: Point, to: Point, species: CreatureSpecies) => boolean;

const REGION_SIZE = 8;
const MAX_CREATURES = 32;
/** How far from its tile's centre an animal may stand: no two visits end on the same spot. */
const STANDING_SPOT_RADIUS = 0.28;
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

export function wildlifeRegion(cell: Cell): string {
  return `${Math.floor(cell.col / REGION_SIZE)}:${Math.floor(cell.row / REGION_SIZE)}`;
}

/** Cosmetic state derived only from presented terrain. Reservations span both ends of every move. */
export class BiomeCreaturePopulation {
  readonly creatures = new Map<number, RoamingCreature>();
  private cells = new Map<string, TerrainCellInput>();
  private nextId = 0;

  constructor(private readonly isPathClear: PathCheck = () => true) {}

  sync(cells: readonly TerrainCellInput[]): void {
    this.restrictTo(cells);
    for (const [id, creature] of this.creatures) {
      if (creature.target && !this.isPathClear(creature, goalInWorld(creature), creature.species))
        this.creatures.delete(id);
    }
    this.fillVacantRegions();
  }

  /** Immediately remove invalid residents; terrain commits defer costly ambient spawning until update/load. */
  restrictTo(cells: readonly TerrainCellInput[]): void {
    this.cells = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
    this.removeInvalidCreatures();
    for (const creature of this.creatures.values()) placeInWorld(creature);
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const dt = Math.min(deltaSeconds, 0.05);
    const reserved = this.reservedRegions();
    for (const creature of this.creatures.values()) {
      creature.age += dt;
      if (creature.target) walk(creature, dt);
      else comeToRest(creature, dt);
      // Asked in the frame it arrives too, so an animal that walks on keeps its pace across the tile.
      if (!creature.target && (creature.wait -= dt) <= 0) this.chooseDestination(creature, reserved);
      placeInWorld(creature);
    }
  }

  private removeInvalidCreatures(): void {
    for (const [id, creature] of this.creatures) {
      if (
        !this.canVisit(creature.cell, creature.species) ||
        (creature.target && !this.canVisit(creature.target, creature.species))
      ) {
        this.creatures.delete(id);
      }
    }
  }

  private fillVacantRegions(): void {
    const reserved = this.reservedRegions();
    const candidates = [...this.cells.values()]
      .map((cell) => ({ cell, priority: priority(cell, 0) }))
      .toSorted((a, b) => a.priority - b.priority || a.cell.row - b.cell.row || a.cell.col - b.cell.col)
      .map(({ cell }) => cell);
    for (const cell of candidates) {
      if (this.creatures.size >= MAX_CREATURES) break;
      const region = wildlifeRegion(cell);
      const species = creatureForBiome(cell.biome);
      if (!species || reserved.has(region) || !this.canVisit(cell, species)) continue;
      const creature = createRoamingCreature(this.nextId, species, cell);
      if (!this.isPathClear(creature, creature, species)) continue;
      this.nextId++;
      this.creatures.set(creature.id, creature);
      reserved.add(region);
    }
  }

  private canVisit(coordinate: Cell, species: CreatureSpecies): boolean {
    const cell = this.cells.get(terrainCellKey(coordinate.col, coordinate.row));
    if (!cell?.explored || cell.occupied || !creatureForBiome(cell.biome)) return false;
    const mode = creatureTraits(species).movement;
    if (mode !== "air" && isTerrainWaterBiome(cell.biome) !== (mode === "water")) return false;
    // A full visible ring keeps the articulated body from projecting into unrevealed or occupied cells.
    return terrainNeighborCoordinates(cell.col, cell.row).every((neighbor) => {
      const adjacent = this.cells.get(terrainCellKey(neighbor.col, neighbor.row));
      return adjacent?.explored && !adjacent.occupied;
    });
  }

  private reservedRegions(): Set<string> {
    const reserved = new Set<string>();
    for (const creature of this.creatures.values()) {
      reserved.add(wildlifeRegion(creature.cell));
      if (creature.target) reserved.add(wildlifeRegion(creature.target));
    }
    return reserved;
  }

  private chooseDestination(creature: RoamingCreature, reserved: Set<string>): void {
    const currentRegion = wildlifeRegion(creature.cell);
    const seed = creature.steps + creature.id + 3;
    const candidates = terrainNeighborCoordinates(creature.cell.col, creature.cell.row).toSorted(
      (a, b) => priority(a, seed) - priority(b, seed),
    );
    const target = candidates.find(
      (cell) =>
        (wildlifeRegion(cell) === currentRegion || !reserved.has(wildlifeRegion(cell))) &&
        this.canVisit(cell, creature.species) &&
        this.isPathClear(creature, standingSpotInWorld(cell), creature.species),
    );
    creature.steps++;
    if (!target) {
      creature.wait = 2;
      creature.action = "stand";
      return;
    }
    creature.target = target;
    creature.goal = offsetBetween(creature.cell, standingSpotInWorld(target));
    creature.stopping = priority(target, seed + 11) >= creatureTraits(creature.species).wanderlust;
    reserved.add(wildlifeRegion(target));
  }
}

/** Steers toward the walk's end: turns first, moves off as it comes to face its way, and slows to a stop there. */
function walk(creature: RoamingCreature, dt: number): void {
  const traits = creatureTraits(creature.species);
  const goalX = creature.goal.x - creature.offset.x;
  const goalZ = creature.goal.z - creature.offset.z;
  const remaining = Math.hypot(goalX, goalZ);
  const bearingError = wrapAngle(Math.atan2(goalX, goalZ) - creature.yaw);
  turnToward(creature, bearingError, traits, dt);
  const cruise = traits.pace * facingShare(bearingError) * arrivalShare(creature, remaining) * burstShare(creature);
  creature.speed = approach(creature.speed, cruise, (traits.pace * dt) / SECONDS_TO_CRUISE);
  const flying = traits.movement === "air" && remaining > LANDING_DISTANCE && cruise > 0;
  creature.lift = approach(creature.lift, flying ? 1 : 0, dt / SECONDS_TO_CLIMB);
  const step = creature.speed * dt;
  if (remaining <= Math.max(step, 0.04)) arrive(creature);
  else advance(creature, step, dt);
}

function turnToward(creature: RoamingCreature, bearingError: number, traits: CreatureTraits, dt: number): void {
  const wanted = clamp(bearingError * 4, -traits.agility, traits.agility);
  creature.turn = approach(creature.turn, wanted, traits.agility * 8 * dt);
  creature.yaw = wrapAngle(creature.yaw + creature.turn * dt);
}

function advance(creature: RoamingCreature, step: number, dt: number): void {
  creature.offset.x += Math.sin(creature.yaw) * step;
  creature.offset.z += Math.cos(creature.yaw) * step;
  // A body turning on the spot still has to step round: its legs cover the arc its ends sweep.
  creature.stride += step + Math.abs(creature.turn) * dt * creatureTraits(creature.species).size * 0.3;
}

function arrive(creature: RoamingCreature): void {
  const target = creature.target!;
  const tileStep = offsetBetween(creature.cell, terrainHexToWorld(target.col, target.row));
  creature.offset = { x: creature.offset.x - tileStep.x, z: creature.offset.z - tileStep.z };
  creature.cell = target;
  creature.target = null;
  if (!creature.stopping) {
    creature.wait = 0;
    return;
  }
  const traits = creatureTraits(creature.species);
  creature.action = traits.idle[Math.floor(priority(target, creature.steps + creature.id) * traits.idle.length)];
  creature.wait = traits.pause[0] + priority(target, creature.steps) * (traits.pause[1] - traits.pause[0]);
}

/** Lets a stopped animal's last momentum run out, so a walk never ends on a frozen frame. */
function comeToRest(creature: RoamingCreature, dt: number): void {
  const traits = creatureTraits(creature.species);
  creature.speed = approach(creature.speed, 0, (traits.pace * dt) / SECONDS_TO_STOP);
  creature.turn = approach(creature.turn, 0, traits.agility * 8 * dt);
  creature.lift = approach(creature.lift, 0, dt / SECONDS_TO_CLIMB);
  if (creature.speed > 0) advance(creature, creature.speed * dt, dt);
}

function facingShare(bearingError: number): number {
  return clamp((Math.cos(bearingError) - FACING_COSINE) / (0.9 - FACING_COSINE), 0, 1);
}

function arrivalShare(creature: RoamingCreature, remaining: number): number {
  return creature.stopping ? clamp(remaining / ARRIVAL_DISTANCE, ARRIVAL_PACE, 1) : 1;
}

function burstShare(creature: RoamingCreature): number {
  const bursts = creatureTraits(creature.species).bursts;
  if (!bursts) return 1;
  const [run, freeze] = bursts;
  return (creature.age + creature.id * 0.37) % (run + freeze) < run ? 1 : 0;
}

function placeInWorld(creature: RoamingCreature): void {
  const centre = terrainHexToWorld(creature.cell.col, creature.cell.row);
  creature.x = centre.x + creature.offset.x;
  creature.z = centre.z + creature.offset.z;
}

function goalInWorld(creature: RoamingCreature): Point {
  const centre = terrainHexToWorld(creature.cell.col, creature.cell.row);
  return { x: centre.x + creature.goal.x, z: centre.z + creature.goal.z };
}

function standingSpotInWorld(cell: Cell): Point {
  const centre = terrainHexToWorld(cell.col, cell.row);
  const spot = standingSpot(cell);
  return { x: centre.x + spot.x, z: centre.z + spot.z };
}

/** Where on a tile an animal stands: a spot of its own, off the centre. */
function standingSpot(cell: Cell): Point {
  const angle = priority(cell, 5) * Math.PI * 2;
  const radius = STANDING_SPOT_RADIUS * Math.sqrt(priority(cell, 6));
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}

function offsetBetween(cell: Cell, point: Point): Point {
  const centre = terrainHexToWorld(cell.col, cell.row);
  return { x: point.x - centre.x, z: point.z - centre.z };
}

function priority(cell: Cell, seed: number): number {
  return terrainHashToUnitFloat(
    hashTerrainCoordinates({ ...cell, elevationSeed: 0, moistureSeed: 0, salt: `biome-creature:${seed}` }),
  );
}

function createRoamingCreature(id: number, species: CreatureSpecies, cell: Cell): RoamingCreature {
  const offset = standingSpot(cell);
  const creature: RoamingCreature = {
    id,
    species,
    cell: { col: cell.col, row: cell.row },
    target: null,
    x: 0,
    z: 0,
    yaw: priority(cell, 2) * Math.PI * 2,
    speed: 0,
    turn: 0,
    stride: 0,
    lift: 0,
    action: "stand",
    wait: 1 + priority(cell, 1) * 3,
    steps: 0,
    age: 0,
    offset,
    goal: offset,
    stopping: true,
  };
  placeInWorld(creature);
  return creature;
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
