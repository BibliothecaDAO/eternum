import { ReservedHyperstructureModelPath } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { FELT_CENTER } from "@/ui/config";
import { type ReservedHyperstructureTileSystemUpdate } from "@bibliothecadao/eternum";
import { type HexPosition } from "@bibliothecadao/types";
import { Color, Material, Matrix4, Mesh, MeshStandardMaterial, Object3D, Scene } from "three";
import { getWorldPositionForHex } from "../utils";
import { gltfLoader } from "../utils/utils";

const INITIAL_CAPACITY = 32;
const RESERVED_HYPERSTRUCTURE_COLOR = new Color(0xf3cc5b);
const RESERVED_HYPERSTRUCTURE_OPACITY = 0.42;
const RESERVED_HYPERSTRUCTURE_Y_OFFSET = 0.05;

const createReservedHyperstructureKey = (hexCoords: HexPosition) => `${hexCoords.col}:${hexCoords.row}`;

const cloneReservedHyperstructureMaterial = (material: Material) => {
  const cloned = material.clone();

  if (cloned instanceof MeshStandardMaterial) {
    cloned.transparent = true;
    cloned.opacity = RESERVED_HYPERSTRUCTURE_OPACITY;
    cloned.depthWrite = false;
    cloned.emissive = RESERVED_HYPERSTRUCTURE_COLOR.clone();
    cloned.emissiveIntensity = Math.max(cloned.emissiveIntensity, 0.7);
    cloned.roughness = 0.68;
    cloned.metalness = 0.18;
  }

  return cloned;
};

const applyReservedHyperstructureMaterialStyle = (gltf: any) => {
  gltf.scene.traverse((child: unknown) => {
    if (!(child instanceof Mesh) || !child.material) {
      return;
    }

    child.material = Array.isArray(child.material)
      ? child.material.map(cloneReservedHyperstructureMaterial)
      : cloneReservedHyperstructureMaterial(child.material);
  });
};

export class ReservedHyperstructureManager {
  private readonly dummy = new Object3D();
  private readonly reservedHyperstructureHexes = new Map<string, HexPosition>();
  private readonly instanceMatrix = new Matrix4();
  private reservedHyperstructureModel: InstancedModel | null = null;
  private destroyed = false;

  constructor(private readonly scene: Scene) {
    void this.loadModel();
  }

  public getVisibleCount(): number {
    return this.reservedHyperstructureHexes.size;
  }

  public onUpdate(update: ReservedHyperstructureTileSystemUpdate): void {
    const normalizedHexCoords = this.normalizeHexCoords(update.hexCoords);
    const key = createReservedHyperstructureKey(normalizedHexCoords);

    if (update.removed) {
      this.reservedHyperstructureHexes.delete(key);
    } else {
      this.reservedHyperstructureHexes.set(key, normalizedHexCoords);
    }

    this.renderReservedHyperstructures();
  }

  public destroy(): void {
    this.destroyed = true;
    this.reservedHyperstructureModel?.dispose();
    this.reservedHyperstructureModel = null;
    this.reservedHyperstructureHexes.clear();
  }

  private async loadModel(): Promise<void> {
    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        gltfLoader.load(ReservedHyperstructureModelPath, resolve, undefined, reject);
      });

      if (this.destroyed) {
        return;
      }

      applyReservedHyperstructureMaterialStyle(gltf);
      const reservedHyperstructureModel = new InstancedModel(gltf, INITIAL_CAPACITY, false, "ReservedHyperstructure");
      reservedHyperstructureModel.setContactShadowsEnabled(false);
      this.scene.add(reservedHyperstructureModel.group);
      this.reservedHyperstructureModel = reservedHyperstructureModel;
      this.renderReservedHyperstructures();
    } catch (error) {
      console.error("[ReservedHyperstructureManager] Failed to load reserved hyperstructure model", error);
    }
  }

  private renderReservedHyperstructures(): void {
    const reservedHyperstructureModel = this.reservedHyperstructureModel;
    if (!reservedHyperstructureModel) {
      return;
    }

    const entries = Array.from(this.reservedHyperstructureHexes.values());
    const previousCount = reservedHyperstructureModel.getCount();

    entries.forEach((hexCoords, index) => {
      this.instanceMatrix.copy(this.resolveInstanceMatrix(hexCoords));
      reservedHyperstructureModel.setMatrixAt(index, this.instanceMatrix);
      reservedHyperstructureModel.setColorAt(index, RESERVED_HYPERSTRUCTURE_COLOR);
    });

    for (let index = entries.length; index < previousCount; index += 1) {
      reservedHyperstructureModel.removeInstance(index);
    }

    reservedHyperstructureModel.setCount(entries.length);
    reservedHyperstructureModel.needsUpdate();
  }

  private resolveInstanceMatrix(hexCoords: HexPosition): Matrix4 {
    const position = getWorldPositionForHex(hexCoords);
    this.dummy.position.set(position.x, position.y + RESERVED_HYPERSTRUCTURE_Y_OFFSET, position.z);
    this.dummy.updateMatrix();
    return this.dummy.matrix;
  }

  private normalizeHexCoords(hexCoords: HexPosition): HexPosition {
    return {
      col: hexCoords.col - FELT_CENTER(),
      row: hexCoords.row - FELT_CENTER(),
    };
  }
}
