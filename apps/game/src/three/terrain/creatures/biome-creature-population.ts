import { terrainCellKey, terrainHexToWorld, terrainNeighborCoordinates } from "../terrain-coordinates";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "../terrain-hash";
import type { TerrainCellInput } from "../terrain-types";
import { isTerrainWaterBiome } from "../terrain-water";
import { creatureForBiome, creatureMovement } from "./biome-creature-catalog";

interface Cell {
  col: number;
  row: number;
}
export interface RoamingCreature {
  id: number;
  species: string;
  cell: Cell;
  target: Cell | null;
  progress: number;
  wait: number;
  steps: number;
  x: number;
  z: number;
  yaw: number;
}
const REGION_SIZE = 8;
const MAX_CREATURES = 32;
const WALK_SECONDS = 6;

export function wildlifeRegion(cell: Cell): string {
  return `${Math.floor(cell.col / REGION_SIZE)}:${Math.floor(cell.row / REGION_SIZE)}`;
}

/** Cosmetic state derived only from presented terrain. Reservations span both ends of every move. */
export class BiomeCreaturePopulation {
  readonly creatures = new Map<number, RoamingCreature>();
  private cells = new Map<string, TerrainCellInput>();
  private nextId = 0;

  constructor(private readonly isPathClear: (from: Cell, to: Cell, species: string) => boolean = () => true) {}

  sync(cells: readonly TerrainCellInput[]): void {
    this.restrictTo(cells);
    for (const [id, creature] of this.creatures) {
      if (creature.target && !this.isPathClear(creature.cell, creature.target, creature.species))
        this.creatures.delete(id);
    }
    this.fillVacantRegions();
  }

  /** Immediately remove invalid residents; terrain commits defer costly ambient spawning until update/load. */
  restrictTo(cells: readonly TerrainCellInput[]): void {
    this.cells = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
    this.removeInvalidCreatures();
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const dt = Math.min(deltaSeconds, 0.05);
    const reserved = this.reservedRegions();
    for (const creature of this.creatures.values()) {
      if (creature.target) this.advance(creature, dt);
      else if ((creature.wait -= dt) <= 0) this.chooseDestination(creature, reserved);
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
      .sort((a, b) => a.priority - b.priority || a.cell.row - b.cell.row || a.cell.col - b.cell.col)
      .map(({ cell }) => cell);
    for (const cell of candidates) {
      if (this.creatures.size >= MAX_CREATURES) break;
      const region = wildlifeRegion(cell);
      const species = creatureForBiome(cell.biome);
      if (!species || reserved.has(region) || !this.canVisit(cell, species) || !this.isPathClear(cell, cell, species))
        continue;
      const creature = createRoamingCreature(this.nextId++, species, cell);
      this.creatures.set(creature.id, creature);
      reserved.add(region);
    }
  }

  private canVisit(coordinate: Cell, species: string): boolean {
    const cell = this.cells.get(terrainCellKey(coordinate.col, coordinate.row));
    if (!cell?.explored || cell.occupied || !creatureForBiome(cell.biome)) return false;
    const mode = creatureMovement(species);
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
    const candidates = terrainNeighborCoordinates(creature.cell.col, creature.cell.row).sort(
      (a, b) => priority(a, creature.steps + creature.id + 3) - priority(b, creature.steps + creature.id + 3),
    );
    const target = candidates.find(
      (cell) =>
        (wildlifeRegion(cell) === currentRegion || !reserved.has(wildlifeRegion(cell))) &&
        this.canVisit(cell, creature.species) &&
        this.isPathClear(creature.cell, cell, creature.species),
    );
    creature.steps++;
    if (!target) {
      creature.wait = 2;
      return;
    }
    creature.target = target;
    creature.progress = 0;
    reserved.add(wildlifeRegion(target));
  }

  private advance(creature: RoamingCreature, dt: number): void {
    const target = creature.target!;
    const from = terrainHexToWorld(creature.cell.col, creature.cell.row);
    const to = terrainHexToWorld(target.col, target.row);
    const desiredYaw = Math.atan2(to.x - from.x, to.z - from.z);
    const yawDelta = Math.atan2(Math.sin(desiredYaw - creature.yaw), Math.cos(desiredYaw - creature.yaw));
    creature.yaw += Math.max(-dt * 2, Math.min(dt * 2, yawDelta));
    // Turn before walking so a new destination never makes an animal slide sideways.
    if (Math.abs(yawDelta) > 0.1) return;
    creature.progress = Math.min(1, creature.progress + dt / WALK_SECONDS);
    creature.x = from.x + (to.x - from.x) * creature.progress;
    creature.z = from.z + (to.z - from.z) * creature.progress;
    if (creature.progress === 1) {
      creature.cell = target;
      creature.target = null;
      creature.wait = 1 + priority(target, creature.steps) * 3;
    }
  }
}

function priority(cell: Cell, seed: number): number {
  return terrainHashToUnitFloat(
    hashTerrainCoordinates({ ...cell, elevationSeed: 0, moistureSeed: 0, salt: `biome-creature:${seed}` }),
  );
}

function createRoamingCreature(id: number, species: string, cell: Cell): RoamingCreature {
  return {
    id,
    species,
    cell: { col: cell.col, row: cell.row },
    target: null,
    progress: 0,
    wait: 1 + priority(cell, 1) * 3,
    steps: 0,
    ...terrainHexToWorld(cell.col, cell.row),
    yaw: priority(cell, 2) * Math.PI * 2,
  };
}
