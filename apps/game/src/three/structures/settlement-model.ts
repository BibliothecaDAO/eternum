import { BufferGeometry, InstancedBufferAttribute, Mesh, type CanvasTexture, type MeshStandardMaterial } from "three";
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
  createRealmBannerAtlas,
  prepareRealmBannerAtlas,
  resolveRealmBannerRow,
  REALM_ATLAS_COLUMNS,
  REALM_ATLAS_ROWS,
  REALM_NEUTRAL_ROW,
  SETTLEMENT_RELATIONSHIP_ORDER,
  type SettlementRelationship,
} from "./settlement-appearance";

/** Shared gameplay presentation with independent heraldry on each settlement instance. */
export class SettlementModel extends InstancedModel {
  private readonly settlementAnimation: SettlementAnimation;
  private readonly bannerAtlas: CanvasTexture;
  private preparation?: Promise<void>;
  private readonly heraldry: InstancedBufferAttribute;
  private readonly clothGeometries: Array<{ mesh: Mesh; original: BufferGeometry }> = [];
  private wind = { windX: 0, windZ: 0 };
  private disposed = false;

  constructor(
    gltf: GLTF,
    capacity: number,
    readonly kind: "village" | "realm" = "village",
  ) {
    super(gltf, capacity, false, kind === "village" ? "Village" : "Realm");
    this.bannerAtlas = kind === "village" ? createVillageBannerAtlas() : createRealmBannerAtlas();
    const cloth = new Map<string, boolean>();
    gltf.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const role = kind === "village" ? node.userData.relationshipCloth : node.userData.orderCloth;
      if (role) cloth.set(node.geometry.uuid, role === "banner");
    });
    const surfaces = this.instancedMeshes
      .filter((mesh) => cloth.has(mesh.geometry.uuid))
      .map((mesh) => ({ mesh, original: mesh.geometry, banner: cloth.get(mesh.geometry.uuid)! }));
    this.settlementAnimation = new SettlementAnimation(gltf.scene, this.instancedMeshes);
    this.heraldry = new InstancedBufferAttribute(
      new Float32Array(this.instancedMeshes[0].instanceMatrix.count).fill(
        kind === "village" ? SETTLEMENT_RELATIONSHIP_ORDER.indexOf("enemy") : REALM_NEUTRAL_ROW,
      ),
      1,
    );
    this.applyHeraldryMaterials(surfaces);
  }

  private applyHeraldryMaterials(surfaces: Array<{ mesh: Mesh; original: BufferGeometry; banner: boolean }>): void {
    for (const { mesh, original, banner } of surfaces) {
      // Animated surfaces already own cloned geometry; static cloth needs the same isolation.
      if (mesh.geometry === original) {
        mesh.geometry = original.clone();
        this.clothGeometries.push({ mesh, original });
      }
      mesh.geometry.setAttribute("settlementHeraldry", this.heraldry);
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
    const row = attribute<"float">("settlementHeraldry", "float");
    const tileWidth = this.kind === "village" ? 256 : 128;
    const tileHeight = this.kind === "village" ? 512 : 256;
    const clothUv = banner
      ? uv()
          .mul(vec2((tileWidth - 1) / tileWidth, (tileHeight - 1) / tileHeight))
          .add(vec2(0.5 / tileWidth, 0.5 / tileHeight))
      : vec2(0.01, 0.99);
    const columns = this.kind === "village" ? 1 : REALM_ATLAS_COLUMNS;
    const rows = this.kind === "village" ? SETTLEMENT_RELATIONSHIP_ORDER.length : REALM_ATLAS_ROWS;
    material.colorNode = texture(
      this.bannerAtlas,
      vec2(clothUv.x.add(row.mod(columns)).div(columns), clothUv.y.add(row.div(columns).floor()).div(rows)),
    ).rgb;
    return material;
  }

  prepare(): Promise<void> {
    if (this.kind === "village") return Promise.resolve();
    return (this.preparation ??= prepareRealmBannerAtlas(this.bannerAtlas));
  }

  setOrderAt(index: number, orderId: number | undefined): void {
    if (this.kind !== "realm") throw new Error("Only realms have order heraldry");
    this.heraldry.setX(index, resolveRealmBannerRow(orderId));
    this.heraldry.needsUpdate = true;
  }

  setRelationshipAt(index: number, relationship: SettlementRelationship): void {
    if (this.kind !== "village") throw new Error("Only villages have relationship heraldry");
    this.heraldry.setX(index, SETTLEMENT_RELATIONSHIP_ORDER.indexOf(relationship));
    this.heraldry.needsUpdate = true;
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
