import { CanvasTexture, SRGBColorSpace, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { MaterialPool } from "../utils/material-pool";

export const SETTLEMENT_RELATIONSHIPS = {
  owned: { label: "Owned · green", color: "#438b46" },
  allied: { label: "Allied · blue", color: "#387bc1" },
  enemy: { label: "Enemy / unowned · red", color: "#aa3028" },
} as const;
export type SettlementRelationship = keyof typeof SETTLEMENT_RELATIONSHIPS;

/** Relationship cloth is isolated from pooled materials; the model owns its clones. */
export class SettlementAppearance {
  private readonly cloth: MeshStandardMaterial[] = [];
  private readonly banners = new Set<MeshStandardMaterial>();
  private bannerTexture: CanvasTexture | null = null;

  constructor(source: Object3D, instances: readonly Mesh[]) {
    const surfaces = new Map<string, boolean>();
    source.traverse((node) => {
      if (node instanceof Mesh && node.userData.relationshipCloth) {
        surfaces.set(node.geometry.uuid, node.userData.settlementMotion === "banner");
      }
    });
    const pool = MaterialPool.getInstance();
    for (const instance of instances) {
      if (!surfaces.has(instance.geometry.uuid)) continue;
      if (!(instance.material instanceof MeshStandardMaterial))
        throw new Error("Settlement cloth requires a standard material");
      const original = instance.material;
      const material = original.clone();
      instance.material = material;
      if (pool.isManagedMaterial(original)) pool.releaseMaterial(original);
      else original.dispose();
      this.cloth.push(material);
      if (surfaces.get(instance.geometry.uuid)) this.banners.add(material);
    }
  }

  setRelationship(relationship: SettlementRelationship): void {
    const appearance = SETTLEMENT_RELATIONSHIPS[relationship];
    if (!appearance) throw new Error(`Unknown settlement relationship: ${relationship}`);
    for (const material of this.cloth) material.color.set(appearance.color);
    if (this.banners.size === 0) return;
    this.bannerTexture ??= createVillageBannerTexture();
    paintVillageBanner(this.bannerTexture, appearance.color);
    for (const material of this.banners) {
      material.color.set("#ffffff");
      material.map = this.bannerTexture;
      material.needsUpdate = true;
    }
  }

  dispose(): void {
    this.bannerTexture?.dispose();
    this.bannerTexture = null;
    this.banners.clear();
    this.cloth.length = 0;
  }
}

function createVillageBannerTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const texture = new CanvasTexture(canvas);
  texture.name = "Village huts and palisade imprint";
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

function paintVillageBanner(texture: CanvasTexture, color: string): void {
  const canvas = texture.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Village banner canvas is unavailable");
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f3e5c7";
  // Flat stamp of the existing village label's two huts and pointed palisade.
  drawStampPolygon(context, [
    [52, 190],
    [93, 144],
    [134, 190],
  ]);
  context.fillRect(66, 192, 54, 48);
  drawStampPolygon(context, [
    [105, 190],
    [153, 134],
    [201, 190],
  ]);
  context.fillRect(121, 192, 64, 48);
  for (let i = 0; i < 5; i++) {
    const x = 56 + i * 32;
    drawStampPolygon(context, [
      [x, 235],
      [x + 9, 219],
      [x + 18, 235],
      [x + 18, 281],
      [x, 281],
    ]);
  }
  context.fillRect(48, 247, 158, 9);
  context.fillStyle = color;
  context.fillRect(146, 205, 15, 31);
  texture.needsUpdate = true;
}

function drawStampPolygon(context: CanvasRenderingContext2D, points: readonly (readonly [number, number])[]): void {
  context.beginPath();
  context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
  context.closePath();
  context.fill();
}
