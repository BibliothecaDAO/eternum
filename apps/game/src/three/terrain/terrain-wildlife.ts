import { Group, Matrix4, Vector3 } from "three";
import type { MeshStandardNodeMaterial } from "three/webgpu";
import { createCreatureAnimator } from "./creatures/biome-creature-animator.js";
import { disposeBiomeCreature, loadBiomeCreature } from "./creatures/biome-creature-assets";
import { creatureMovement } from "./creatures/biome-creature-catalog";
import { BiomeCreaturePopulation, type RoamingCreature, wildlifeRegion } from "./creatures/biome-creature-population";
import {
  findNearestTerrainHex,
  terrainCellKey,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "./terrain-coordinates";
import { getTerrainPropRole } from "./terrain-prop-catalog";
import type { TerrainCellInput, TerrainPropInstance, TerrainSurfaceSample } from "./terrain-types";
import { isTerrainWaterBiome, TERRAIN_WATER_LEVEL } from "./terrain-water";

type Animator = ReturnType<typeof createCreatureAnimator>;
interface WildlifeView {
  root: Group;
  animator: Animator;
}

export class TerrainWildlife {
  readonly object3d = new Group();
  private readonly population = new BiomeCreaturePopulation((from, to, species) => this.isPathClear(from, to, species));
  private readonly templates = new Map<string, Promise<Group | null>>();
  private readonly views = new Map<number, WildlifeView>();
  private readonly failures = new Set<string>();
  private cells = new Map<string, TerrainCellInput>();
  private obstacles = new Map<string, TerrainPropInstance[]>();
  private time = 0;
  private readonly up = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly orientation = new Matrix4();
  private disposed = false;
  private pending = 0;
  private needsLoad = true;
  private needsPopulation = false;

  constructor(
    private readonly sampleSurface: (x: number, z: number) => TerrainSurfaceSample,
    private readonly reveal: (material: MeshStandardNodeMaterial) => void,
  ) {
    this.object3d.name = "terrain-wildlife";
  }

  sync(cells: readonly TerrainCellInput[], props: readonly TerrainPropInstance[]): void {
    this.cells = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
    this.obstacles.clear();
    for (const prop of props) {
      if (getTerrainPropRole(prop.archetype) === "groundcover") continue;
      const key = terrainCellKey(prop.ownerCol, prop.ownerRow);
      const list = this.obstacles.get(key) ?? [];
      list.push(prop);
      this.obstacles.set(key, list);
    }
    this.population.restrictTo(cells);
    this.needsPopulation = true;
    this.removeReleasedViews();
    this.needsLoad = true;
  }

  async load(): Promise<void> {
    if (this.disposed || !this.object3d.visible) return;
    this.populatePresentedTerrain();
    this.needsLoad = false;
    await Promise.all(
      [...new Set([...this.population.creatures.values()].map((creature) => creature.species))].map((species) =>
        this.loadTemplate(species),
      ),
    );
    if (!this.disposed) await this.attachMissingViews();
  }

  update(deltaSeconds: number): void {
    if (this.disposed || !this.object3d.visible) return;
    const dt = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
    this.time += dt;
    this.population.update(dt);
    // Loading is triggered once per population change, never one promise per animation frame.
    if (this.needsLoad) void this.load();
    for (const creature of this.population.creatures.values()) {
      const view = this.views.get(creature.id);
      if (view) this.poseView(view, creature);
    }
  }

  getStats() {
    return {
      count: this.population.creatures.size,
      loaded: this.views.size,
      pending: this.pending,
      failed: [...this.failures],
      visible: this.object3d.visible,
      creatures: [...this.population.creatures.values()].map((creature) => ({
        id: creature.id,
        species: creature.species,
        x: creature.x,
        z: creature.z,
        region: wildlifeRegion(findNearestTerrainHex(creature.x, creature.z)),
        biome: this.sampleSurface(creature.x, creature.z).biome,
        moving: creature.target !== null && creature.progress > 0,
      })),
    };
  }

  dispose(): void {
    this.disposed = true;
    this.object3d.clear();
    this.views.clear();
    this.population.creatures.clear();
    this.cells.clear();
    this.obstacles.clear();
    this.templates.forEach((promise) => {
      void promise.then((template) => {
        if (template) disposeBiomeCreature(template);
      });
    });
    this.templates.clear();
  }

  private populatePresentedTerrain(): void {
    if (!this.needsPopulation) return;
    this.population.sync([...this.cells.values()]);
    this.needsPopulation = false;
    this.removeReleasedViews();
  }

  private loadTemplate(species: string): Promise<Group | null> {
    let promise = this.templates.get(species);
    if (!promise) {
      this.pending++;
      promise = loadBiomeCreature(species, this.reveal)
        .catch((error) => {
          this.failures.add(species);
          console.error(`[terrain-wildlife] Could not load ${species}`, error);
          return null;
        })
        .finally(() => {
          this.pending--;
        });
      this.templates.set(species, promise);
    }
    return promise;
  }

  private async attachMissingViews(): Promise<void> {
    for (const creature of this.population.creatures.values()) {
      const template = await this.loadTemplate(creature.species);
      if (this.disposed) return;
      if (!template || this.views.has(creature.id) || !this.population.creatures.has(creature.id)) continue;
      const rig = template.clone(true);
      const root = new Group();
      root.name = `biome-creature:${creature.species}:${creature.id}`;
      root.add(rig);
      const view = { root, animator: createCreatureAnimator(rig, { seed: creature.id }) };
      this.views.set(creature.id, view);
      this.poseView(view, creature);
      this.object3d.add(root);
    }
  }

  private removeReleasedViews(): void {
    for (const [id, view] of this.views)
      if (!this.population.creatures.has(id)) {
        this.object3d.remove(view.root);
        this.views.delete(id);
      }
  }

  private poseView(view: WildlifeView, creature: RoamingCreature): void {
    const surface = this.sampleSurface(creature.x, creature.z);
    const mode = creatureMovement(creature.species);
    const height = mode === "water" ? TERRAIN_WATER_LEVEL + 0.03 : surface.height + (mode === "air" ? 0.5 : 0.015);
    view.root.position.set(creature.x, height, creature.z);
    this.up.set(...(mode === "land" ? surface.normal : ([0, 1, 0] as const)));
    this.forward.set(Math.sin(creature.yaw), 0, Math.cos(creature.yaw)).projectOnPlane(this.up).normalize();
    this.right.crossVectors(this.up, this.forward).normalize();
    view.root.quaternion.setFromRotationMatrix(this.orientation.makeBasis(this.right, this.up, this.forward));
    view.animator.update(this.time, { activity: creature.target && creature.progress > 0 ? "move" : "idle" });
  }

  private isPathClear(from: { col: number; row: number }, to: { col: number; row: number }, species: string): boolean {
    const start = terrainHexToWorld(from.col, from.row),
      end = terrainHexToWorld(to.col, to.row);
    const mode = creatureMovement(species);
    let previousHeight: number | undefined;
    const samples = from.col === to.col && from.row === to.row ? 0 : 12;
    for (let index = 0; index <= samples; index++) {
      const x = start.x + ((end.x - start.x) * index) / (samples || 1);
      const z = start.z + ((end.z - start.z) * index) / (samples || 1);
      const owner = findNearestTerrainHex(x, z);
      const cell = this.cells.get(terrainCellKey(owner.col, owner.row));
      if (!cell?.explored || cell.occupied) return false;
      const surface = this.sampleSurface(x, z);
      if (mode === "air") continue;
      if (surface.biome === null || isTerrainWaterBiome(surface.biome) !== (mode === "water")) return false;
      if (
        mode === "land" &&
        (surface.normal[1] < 0.85 || (previousHeight !== undefined && Math.abs(surface.height - previousHeight) > 0.08))
      )
        return false;
      previousHeight = surface.height;
      if (!this.hasPropClearance(x, z, owner)) return false;
    }
    return true;
  }
  private hasPropClearance(x: number, z: number, owner: { col: number; row: number }): boolean {
    for (const cell of [owner, ...terrainNeighborCoordinates(owner.col, owner.row)]) {
      for (const prop of this.obstacles.get(terrainCellKey(cell.col, cell.row)) ?? []) {
        if (Math.hypot(x - prop.worldX, z - prop.worldZ) < 0.4 + prop.scale * 0.25) return false;
      }
    }
    return true;
  }
}
