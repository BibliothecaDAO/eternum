import { VillageModel } from "../structures/village-model";
import {
  TERRAIN_LAB_BUILDINGS,
  VILLAGE_DRAFT_PATH,
  REALM_DRAFT_PATH,
  type TerrainLabBuilding,
} from "./terrain-lab-buildings";
import { SettlementAnimation } from "@/three/structures/settlement-animation";
import type { WeatherState } from "@/three/managers/weather-manager";
import { SettlementAppearance } from "@/three/structures/settlement-appearance";
import { Matrix4, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3 } from "three";

import { buildArmyModelAssetPath } from "@/three/constants/army-constants";
import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import InstancedModel from "@/three/managers/instanced-model";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import {
  findNearestTerrainHex,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "@/three/terrain/terrain-coordinates";
import type { PreparedTerrainPage, TerrainPageRequest } from "@/three/terrain/terrain-types";
import { isTerrainWaterBiome } from "@/three/terrain/terrain-water";
import { gltfLoader } from "@/three/utils/utils";
import { getArmyGroundOffset, groundModelMatrix } from "@/three/utils/model-grounding";

import { DEFAULT_TERRAIN_LAB_PREVIEW, buildTerrainLabRequest, type TerrainLabPreview } from "./terrain-lab-preview";

/** Lab inputs change the fixture; terrain, selection and models use production renderers. */
export class TerrainLabInteraction {
  private readonly hover: HoverHexManager;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly hit = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly armyPosition = new Vector3();
  private readonly models = new Map<string, InstancedModel>();
  private readonly buildings = new Map<string, TerrainLabBuilding>();
  private selected: { col: number; row: number };
  private preview = DEFAULT_TERRAIN_LAB_PREVIEW;
  private army: InstancedModel | null = null;
  private readonly settlementAppearances = new Map<string, SettlementAppearance>();
  private readonly settlementAnimations = new Map<string, SettlementAnimation>();
  private armyType: TerrainLabPreview["army"] = "none";
  private revision = 0;
  private disposed = false;
  private pointerDown: { x: number; y: number } | null = null;
  private spinAngle = 0;
  private selectionDirty = true;
  private exploring = false;
  private pendingExploration: {
    prepared: PreparedTerrainPage;
    source: { col: number; row: number };
    revision: number;
    coveredFrame: boolean;
  } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly scene: Scene,
    private readonly terrain: ProceduralTerrain,
    private readonly request: TerrainPageRequest,
    private readonly onError: (error: unknown) => void,
    private readonly onPresented: (prepared: PreparedTerrainPage, commitMs: number) => void,
    private readonly localMode = false,
  ) {
    this.hover = new HoverHexManager(scene, terrain);
    this.selected = chooseInitialTile(request);
    canvas.addEventListener("pointerdown", this.beginPick);
    canvas.addEventListener("pointerup", this.finishPick);
  }

  async configure(preview: TerrainLabPreview): Promise<void> {
    if (this.localMode && preview.biome === "ethereal") {
      throw new Error("The Ethereal layer preview belongs to the world biome lab");
    }
    const orderChanged = preview.realmOrderId !== this.preview.realmOrderId;
    const wasExploring = this.exploring;
    if (wasExploring) this.cancelExplorationPreview();
    const rebuild =
      wasExploring ||
      preview.fog !== this.preview.fog ||
      preview.army !== this.preview.army ||
      preview.biome !== this.preview.biome;
    this.selectionDirty = true;
    this.preview = preview;
    this.spinAngle = preview.yaw;
    this.updateVillageRelationship();
    await Promise.all([
      orderChanged ? this.settlementAppearances.get(REALM_DRAFT_PATH)?.setOrder(preview.realmOrderId) : undefined,
      rebuild ? this.presentFixture() : undefined,
    ]);
    this.update(0);
  }

  update(delta: number, wind?: Pick<WeatherState, "windX" | "windZ">): void {
    if (this.disposed) return;
    this.advanceExplorationPreview();
    if (wind) {
      const village = this.models.get(VILLAGE_DRAFT_PATH);
      if (village instanceof VillageModel && village.group.visible) {
        village.setWind(wind);
        village.updateAnimations(delta);
      }
      for (const [path, animation] of this.settlementAnimations) {
        if (this.models.get(path)?.group.visible) animation.update(delta, wind);
      }
    }
    if (this.preview.spin) this.spinAngle += delta * 0.65;
    const moved = this.selectionDirty;
    if (moved) {
      const center = terrainHexToWorld(this.selected.col, this.selected.row);
      this.armyPosition.set(center.x, this.terrain.sampleSurface(center.x, center.z).height, center.z);
      if (this.preview.selection) this.hover.showHover(center.x, center.z);
      else this.hover.hideHover();
      this.selectionDirty = false;
    }
    this.hover.update(delta);
    for (const [key, model] of this.models) {
      if (key.startsWith("/") && model.group.visible) model.updateAnimations(delta);
    }
    if (!this.army) return;
    if (moved || this.preview.spin) {
      this.matrix.makeRotationY(this.spinAngle);
      this.matrix.setPosition(this.armyPosition);
      groundModelMatrix(
        this.matrix,
        getArmyGroundOffset(this.army.instancedMeshes, this.armyType === "none" ? undefined : this.armyType),
      );
      this.army.setMatrixAt(0, this.matrix, this.armyPosition.y);
      this.army.needsUpdate();
    }
    this.army.updateAnimations(delta);
  }

  getSelectedPosition(): Vector3 {
    const center = terrainHexToWorld(this.selected.col, this.selected.row);
    return new Vector3(center.x, this.terrain.sampleSurface(center.x, center.z).height, center.z);
  }

  getState() {
    return {
      ...this.preview,
      selected: this.selected,
      spinAngle: this.spinAngle,
      buildings: [...this.buildings.values()],
    };
  }

  async previewExploration(entryEdge: number): Promise<void> {
    const source = terrainNeighborCoordinates(this.selected.col, this.selected.row)[entryEdge];
    if (!Number.isInteger(entryEdge) || !source) throw new Error(`Unknown exploration entry edge: ${entryEdge}`);
    this.cancelExplorationPreview();
    this.exploring = true;
    const revision = this.revision;
    const request = buildTerrainLabRequest(
      this.request,
      this.preview,
      this.selected,
      [...this.buildings.values()],
      this.localMode,
    );
    const selected = { ...this.selected };
    const [covered, revealed] = await Promise.all([
      this.terrain.preparePageAsync(buildLabExplorationRequest(request, selected, false)),
      this.terrain.preparePageAsync(buildLabExplorationRequest(request, selected, true)),
    ]);
    if (this.disposed || revision !== this.revision) return;
    this.presentExplorationPage(covered);
    this.pendingExploration = { prepared: revealed, source, revision, coveredFrame: false };
  }

  async placeBuilding(path: string, yaw: number): Promise<void> {
    this.cancelExplorationPreview();
    const asset = TERRAIN_LAB_BUILDINGS.find((building) => building.path === path);
    if (!asset) throw new Error(`Unknown lab building: ${path}`);
    const selected = { ...this.selected };
    const model = await this.loadModel(path, path, this.request.cells.length, asset.label);
    if (!model || this.disposed) return;
    this.buildings.set(`${selected.col}:${selected.row}`, { ...selected, path, yaw });
    await this.presentFixture();
  }

  async removeBuilding(clearAll = false): Promise<void> {
    if (clearAll) this.buildings.clear();
    else this.buildings.delete(`${this.selected.col}:${this.selected.row}`);
    await this.presentFixture();
  }

  dispose(): void {
    this.disposed = true;
    this.revision++;
    this.canvas.removeEventListener("pointerdown", this.beginPick);
    this.canvas.removeEventListener("pointerup", this.finishPick);
    this.hover.dispose();
    for (const animation of this.settlementAnimations.values()) animation.dispose();
    for (const appearance of this.settlementAppearances.values()) appearance.dispose();
    this.settlementAnimations.clear();
    this.settlementAppearances.clear();
    for (const model of this.models.values()) {
      this.scene.remove(model.group);
      model.dispose();
    }
    this.models.clear();
  }

  private cancelExplorationPreview(): void {
    this.revision++;
    // Initial configuration must leave animations owned by the verification fixture running.
    if (this.exploring) this.terrain.cancelShroudReveals();
    this.exploring = false;
    this.pendingExploration = null;
  }

  private advanceExplorationPreview(): void {
    const pending = this.pendingExploration;
    if (!pending || pending.revision !== this.revision) return;
    // The normal render loop presents one covered frame before the production sweep starts.
    if (!pending.coveredFrame) {
      pending.coveredFrame = true;
      return;
    }
    this.pendingExploration = null;
    this.terrain.queueShroudReveal(this.selected.col, this.selected.row, pending.source);
    this.presentExplorationPage(pending.prepared);
    this.selectionDirty = true;
    this.updateBuildings([...this.buildings.values()]);
  }

  private presentExplorationPage(prepared: PreparedTerrainPage): void {
    const started = performance.now();
    this.terrain.present([prepared]);
    this.onPresented(prepared, performance.now() - started);
  }

  private async presentFixture(): Promise<void> {
    this.cancelExplorationPreview();
    const revision = this.revision;
    const preview = this.preview;
    const selected = this.selected;
    const buildings = [...this.buildings.values()];
    const request = buildTerrainLabRequest(this.request, preview, selected, buildings, this.localMode);
    const prepared = await this.terrain.preparePageAsync(request);
    if (this.disposed || revision !== this.revision) return;
    const fog = await this.terrain.prepareFogMaskAsync([prepared]);
    const model =
      preview.army === "none"
        ? null
        : await this.loadModel(preview.army, buildArmyModelAssetPath(preview.army), 1, preview.army);
    if (this.disposed || revision !== this.revision) return;
    const commitStarted = performance.now();
    this.terrain.setSurfacePresentation(preview.biome === "ethereal" ? "ethereal" : "world");
    this.terrain.refreshPropOccupancy((col, row) => this.buildings.has(`${col}:${row}`));
    this.terrain.present([prepared], fog);
    this.onPresented(prepared, performance.now() - commitStarted);
    this.selectionDirty = true;
    if (this.army) this.army.group.visible = false;
    this.army = model;
    this.armyType = preview.army;
    if (model) model.group.visible = true;
    this.updateBuildings(buildings);
    this.update(0);
  }

  private updateBuildings(buildings: readonly TerrainLabBuilding[]): void {
    const counts = new Map<string, number>();
    for (const building of buildings) {
      const model = this.models.get(building.path)!;
      const center = terrainHexToWorld(building.col, building.row);
      this.matrix.makeRotationY(building.yaw);
      this.matrix.setPosition(center.x, this.terrain.sampleSurface(center.x, center.z).height + 0.025, center.z);
      const index = counts.get(building.path) ?? 0;
      model.setMatrixAt(index, this.matrix);
      if (model instanceof VillageModel) model.setRelationshipAt(index, this.preview.relationship);
      counts.set(building.path, index + 1);
    }
    for (const [path, model] of this.models) {
      if (!path.startsWith("/")) continue;
      const count = counts.get(path) ?? 0;
      model.setCount(count);
      model.group.visible = count > 0;
    }
  }

  private async loadModel(key: string, path: string, capacity: number, name: string): Promise<InstancedModel | null> {
    const existing = this.models.get(key);
    if (existing) return existing;
    const gltf = await gltfLoader.loadAsync(path);
    const model =
      path === VILLAGE_DRAFT_PATH ? new VillageModel(gltf, capacity) : new InstancedModel(gltf, capacity, false, name);
    if (this.disposed || this.models.has(key)) {
      model.dispose();
      return this.models.get(key) ?? null;
    }
    model.setCount(1);
    model.group.visible = false;
    this.models.set(key, model);
    this.scene.add(model.group);
    if (path === REALM_DRAFT_PATH) {
      const appearance = new SettlementAppearance(gltf.scene, model.instancedMeshes);
      this.settlementAppearances.set(path, appearance);
      this.settlementAnimations.set(path, new SettlementAnimation(gltf.scene, model.instancedMeshes));
      await appearance.setOrder(this.preview.realmOrderId);
    }
    this.updateVillageRelationship();
    return model;
  }

  private updateVillageRelationship(): void {
    const village = this.models.get(VILLAGE_DRAFT_PATH);
    if (!(village instanceof VillageModel)) return;
    for (let index = 0; index < village.getCount(); index++) {
      village.setRelationshipAt(index, this.preview.relationship);
    }
  }

  private beginPick = (event: PointerEvent): void => {
    if (event.button === 0) this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private finishPick = (event: PointerEvent): void => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      1 - ((event.clientY - bounds.top) / bounds.height) * 2,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Converge on the same height field used by the model and selection ring.
    this.ground.constant = 0;
    for (let step = 0; step < 4; step++) {
      if (!this.raycaster.ray.intersectPlane(this.ground, this.hit)) return;
      this.ground.constant = -this.terrain.sampleSurface(this.hit.x, this.hit.z).height;
    }
    const selected = findNearestTerrainHex(this.hit.x, this.hit.z);
    if (
      !this.request.cells.some(
        (cell) => cell.col === selected.col && cell.row === selected.row && (!this.localMode || cell.occupied),
      )
    )
      return;
    this.selected = selected;
    void this.presentFixture().catch(this.onError);
  };
}

function chooseInitialTile(request: TerrainPageRequest): { col: number; row: number } {
  const middleCol = request.cells.reduce((sum, cell) => sum + cell.col, 0) / request.cells.length;
  const middleRow = request.cells.reduce((sum, cell) => sum + cell.row, 0) / request.cells.length;
  const candidates = request.cells.filter(
    (cell) => cell.explored && cell.biome !== null && !isTerrainWaterBiome(cell.biome),
  );
  return (
    candidates.toSorted(
      (a, b) =>
        (a.col - middleCol) ** 2 + (a.row - middleRow) ** 2 - (b.col - middleCol) ** 2 - (b.row - middleRow) ** 2,
    )[0] ?? request.cells[0]
  );
}

function buildLabExplorationRequest(
  request: TerrainPageRequest,
  selected: { col: number; row: number },
  explored: boolean,
): TerrainPageRequest {
  return {
    ...request,
    cells: request.cells.map((cell) => {
      if (cell.col !== selected.col || cell.row !== selected.row) return cell;
      const biome = cell.biome ?? cell.previewBiome;
      if (biome == null) throw new Error(`Lab tile ${cell.col},${cell.row} has no biome to reveal`);
      return { ...cell, explored, biome: explored ? biome : null, previewBiome: biome };
    }),
  };
}
