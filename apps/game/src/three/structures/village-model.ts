import { BufferGeometry, InstancedBufferAttribute, Mesh, type MeshStandardMaterial } from "three";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import { attribute, texture, uv, vec2 } from "three/tsl";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import InstancedModel from "../managers/instanced-model";
import type { WeatherState } from "../managers/weather-manager";
import type { AnimationVisibilityContext } from "../types/animation";
import { MaterialPool } from "../utils/material-pool";
import { SettlementAnimation } from "./settlement-animation";
import {
  createVillageBannerAtlas,
  SETTLEMENT_RELATIONSHIP_ORDER,
  type SettlementRelationship,
} from "./settlement-appearance";

/** One instanced village fleet, with independent banner colors for each owner relationship. */
export class VillageModel extends InstancedModel {
  private readonly settlementAnimation: SettlementAnimation;
  private readonly bannerAtlas = createVillageBannerAtlas();
  private readonly relationships: InstancedBufferAttribute;
  private readonly clothGeometries: Array<{ mesh: Mesh; original: BufferGeometry }> = [];
  private wind = { windX: 0, windZ: 0 };
  private disposed = false;

  constructor(gltf: GLTF, capacity: number) {
    super(gltf, capacity, false, "Village");
    const cloth = new Map<string, boolean>();
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh && node.userData.relationshipCloth) {
        cloth.set(node.geometry.uuid, node.userData.settlementMotion === "banner");
      }
    });
    const surfaces = this.instancedMeshes
      .filter((mesh) => cloth.has(mesh.geometry.uuid))
      .map((mesh) => ({ mesh, original: mesh.geometry, banner: cloth.get(mesh.geometry.uuid)! }));
    this.settlementAnimation = new SettlementAnimation(gltf.scene, this.instancedMeshes);
    this.relationships = new InstancedBufferAttribute(
      new Float32Array(this.instancedMeshes[0].instanceMatrix.count).fill(
        SETTLEMENT_RELATIONSHIP_ORDER.indexOf("enemy"),
      ),
      1,
    );
    for (const { mesh, original, banner } of surfaces) {
      // Animated surfaces already own cloned geometry; static cloth needs the same isolation.
      if (mesh.geometry === original) {
        mesh.geometry = original.clone();
        this.clothGeometries.push({ mesh, original });
      }
      mesh.geometry.setAttribute("villageRelationship", this.relationships);
      const previous = mesh.material as MeshStandardMaterial;
      mesh.material = this.createClothMaterial(previous, banner);
      MaterialPool.getInstance().releaseMaterial(previous);
    }
  }

  private createClothMaterial(previous: MeshStandardMaterial, banner: boolean): MeshStandardNodeMaterial {
    const material = new MeshStandardNodeMaterial();
    material.roughness = previous.roughness;
    material.metalness = previous.metalness;
    material.side = previous.side;
    const row = attribute<"float">("villageRelationship", "float");
    const clothUv = banner
      ? uv()
          .mul(vec2(255 / 256, 511 / 512))
          .add(vec2(0.5 / 256, 0.5 / 512))
      : vec2(0.01, 0.99);
    material.colorNode = texture(
      this.bannerAtlas,
      vec2(clothUv.x, clothUv.y.add(row).div(SETTLEMENT_RELATIONSHIP_ORDER.length)),
    ).rgb;
    return material;
  }

  setRelationshipAt(index: number, relationship: SettlementRelationship): void {
    this.relationships.setX(index, SETTLEMENT_RELATIONSHIP_ORDER.indexOf(relationship));
    this.relationships.needsUpdate = true;
  }

  setWind(wind?: Pick<WeatherState, "windX" | "windZ">): void {
    this.wind.windX = wind?.windX ?? 0;
    this.wind.windZ = wind?.windZ ?? 0;
  }

  override updateAnimations(delta: number, visibility?: AnimationVisibilityContext): void {
    super.updateAnimations(delta, visibility);
    if (this.getCount() > 0) this.settlementAnimation.update(delta, this.wind);
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.settlementAnimation.dispose();
    for (const { mesh, original } of this.clothGeometries) {
      mesh.geometry.dispose();
      mesh.geometry = original;
    }
    this.bannerAtlas.dispose();
    super.dispose();
  }
}
