import { TERRAIN_LAB_BUILDINGS, type TerrainLabBuilding } from "./terrain-lab-buildings";
import { Matrix4, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3 } from "three";

import { buildArmyModelAssetPath } from "@/three/constants/army-constants";
import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import InstancedModel from "@/three/managers/instanced-model";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { findNearestTerrainHex, terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
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
  private armyType: TerrainLabPreview["army"] = "none";
  private revision = 0;
  private disposed = false;
  private pointerDown: { x: number; y: number } | null = null;
  private spinAngle = 0;
  private selectionDirty = true;

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
    const rebuild =
      preview.fog !== this.preview.fog || preview.army !== this.preview.army || preview.biome !== this.preview.biome;
    this.selectionDirty = true;
    this.preview = preview;
    this.spinAngle = preview.yaw;
    if (rebuild) await this.presentFixture();
    this.update(0);
  }

  update(delta: number): void {
    if (this.disposed) return;
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

  async placeBuilding(path: string, yaw: number): Promise<void> {
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
    for (const model of this.models.values()) {
      this.scene.remove(model.group);
      model.dispose();
    }
    this.models.clear();
  }

  private async presentFixture(): Promise<void> {
    const revision = ++this.revision;
    const preview = this.preview;
    const selected = this.selected;
    const buildings = [...this.buildings.values()];
    const request = buildTerrainLabRequest(this.request, preview, selected, buildings);
    const prepared = await this.terrain.preparePageAsync(request);
    if (this.disposed || revision !== this.revision) return;
    const fog = await this.terrain.prepareFogMaskAsync([prepared]);
    const model =
      preview.army === "none"
        ? null
        : await this.loadModel(preview.army, buildArmyModelAssetPath(preview.army), 1, preview.army);
    if (this.disposed || revision !== this.revision) return;
    const commitStarted = performance.now();
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
    const model = new InstancedModel(gltf, capacity, false, name);
    if (this.disposed || this.models.has(key)) {
      model.dispose();
      return this.models.get(key) ?? null;
    }
    model.setCount(1);
    model.group.visible = false;
    this.models.set(key, model);
    this.scene.add(model.group);
    return model;
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
