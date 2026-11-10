import { Group, Matrix4, Vector3 } from "three";
import { clone as cloneWithSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { MeshStandardNodeMaterial } from "three/webgpu";
import { createCreatureAnimator } from "./creatures/biome-creature-animator.js";
import { disposeBiomeCreature, loadBiomeCreature, releaseBiomeCreatureBones } from "./creatures/biome-creature-assets";
import { creatureTraits, type CreatureSpecies } from "./creatures/biome-creature-catalog";
import {
  BiomeCreaturePopulation,
  herdOf,
  homeTile,
  type RoamingCreature,
  type WildlifeThreat,
  wildlifeRegion,
} from "./creatures/biome-creature-population";
import { findNearestTerrainHex, terrainCellKey, terrainNeighborCoordinates } from "./terrain-coordinates";
import { getTerrainPropRole } from "./terrain-prop-catalog";
import type { TerrainCellInput, TerrainPropInstance, TerrainSurfaceSample } from "./terrain-types";
import { isTerrainWaterBiome, TERRAIN_WATER_LEVEL } from "./terrain-water";
import { releaseDrawnObject } from "../utils/release-drawn-object";

type Animator = ReturnType<typeof createCreatureAnimator>;
interface WildlifeView {
  root: Group;
  animator: Animator;
  /** World units per unit of the rig: how the ground an animal covers is told to its rig. */
  rigScale: number;
}
interface Point {
  x: number;
  z: number;
}

/** How high a flier cruises over the ground, in world units: above the canopy it crosses. */
const FLIGHT_HEIGHT = 0.8;
/** No two animals of a species are quite the same size, and this year's young are well short of grown. */
const SIZE_VARIATION = 0.16;
const YOUNG_SIZE = 0.62;

export class TerrainWildlife {
  readonly object3d = new Group();
  private readonly population = new BiomeCreaturePopulation((from, to, species) => this.isPathClear(from, to, species));
  private readonly templates = new Map<CreatureSpecies, Promise<Group | null>>();
  private readonly views = new Map<number, WildlifeView>();
  private readonly failures = new Set<string>();
  private readonly threats: WildlifeThreat[] = [];
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

  /** The armies on the map this frame, where they stand in the world: animals watch them and give way. */
  setArmies(armies: readonly { worldX: number; worldZ: number; isMoving: boolean }[]): void {
    this.threats.length = armies.length;
    armies.forEach((army, index) => {
      const threat = (this.threats[index] ??= { x: 0, z: 0, moving: false });
      threat.x = army.worldX;
      threat.z = army.worldZ;
      threat.moving = army.isMoving;
    });
    this.population.setThreats(this.threats);
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
        // A herd is counted where its leader is: the one-herd-to-a-region contract is the leaders'.
        herd: herdOf(creature),
        region: wildlifeRegion(homeTile(this.population.creatures.get(herdOf(creature))!)),
        biome: this.sampleSurface(creature.x, creature.z).biome,
        moving: creature.speed > 0,
        activity: describeActivity(creature),
        mood: creature.mood,
      })),
    };
  }

  dispose(): void {
    this.disposed = true;
    this.object3d.clear();
    this.views.forEach((view) => releaseBiomeCreatureBones(view.root));
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

  private loadTemplate(species: CreatureSpecies): Promise<Group | null> {
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
      // A skinned animal needs its own bones, bound to its own copy of the skin.
      const rig = cloneWithSkeleton(template) as Group;
      const root = new Group();
      root.name = `biome-creature:${creature.species}:${creature.id}`;
      root.add(rig);
      const grown = 1 + SIZE_VARIATION * (((creature.id * 0.618034) % 1) - 0.5);
      root.scale.setScalar(creature.young ? YOUNG_SIZE : grown);
      const view = {
        root,
        animator: createCreatureAnimator(rig, { seed: creature.id }),
        rigScale: rig.scale.x * root.scale.x,
      };
      this.views.set(creature.id, view);
      this.poseView(view, creature);
      this.object3d.add(root);
    }
  }

  private removeReleasedViews(): void {
    for (const [id, view] of this.views)
      if (!this.population.creatures.has(id)) {
        this.object3d.remove(view.root);
        // The creature is a clone sharing its template's geometry and materials: those stay, its render objects go.
        releaseDrawnObject(view.root);
        releaseBiomeCreatureBones(view.root);
        this.views.delete(id);
      }
  }

  private poseView(view: WildlifeView, creature: RoamingCreature): void {
    const traits = creatureTraits(creature.species);
    const surface = this.sampleSurface(creature.x, creature.z);
    const height =
      traits.movement === "water"
        ? TERRAIN_WATER_LEVEL - 0.03
        : surface.height + FLIGHT_HEIGHT * creature.lift * creature.lift * (3 - 2 * creature.lift);
    view.root.position.set(creature.x, height, creature.z);
    const facing = traits.sidles ? creature.yaw - Math.PI / 2 : creature.yaw;
    this.up.set(...(traits.movement === "land" ? surface.normal : ([0, 1, 0] as const)));
    this.forward.set(Math.sin(facing), 0, Math.cos(facing)).projectOnPlane(this.up).normalize();
    this.right.crossVectors(this.up, this.forward).normalize();
    view.root.quaternion.setFromRotationMatrix(this.orientation.makeBasis(this.right, this.up, this.forward));
    view.animator.update(this.time, {
      distance: creature.stride / view.rigScale,
      pace: creature.speed / traits.pace,
      turn: creature.turn,
      action: creature.action,
      lift: creature.lift,
      stealth: creature.hunt?.phase === "stalk",
      gaze:
        creature.gaze === null ? null : Math.atan2(Math.sin(creature.gaze - facing), Math.cos(creature.gaze - facing)),
    });
  }

  /** Whether an animal can go straight from one spot to another: over shown, free ground of its kind, round props. */
  private isPathClear(from: Point, to: Point, species: CreatureSpecies): boolean {
    const mode = creatureTraits(species).movement;
    let previousHeight: number | undefined;
    const samples = from.x === to.x && from.z === to.z ? 0 : 12;
    // Where a walking animal already stands is not asked again: a step short of its spot must never strand it.
    for (let index = Math.min(1, samples); index <= samples; index++) {
      const x = from.x + ((to.x - from.x) * index) / (samples || 1);
      const z = from.z + ((to.z - from.z) * index) / (samples || 1);
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

/** What an animal is doing, in a word, for the lab and the verification snapshot. */
function describeActivity(creature: RoamingCreature): string {
  if (creature.caughtBy !== null) return "caught";
  if (creature.hunt) return creature.hunt.phase;
  if (creature.target) return creature.haste > 1 ? "run" : "walk";
  return creature.action;
}
