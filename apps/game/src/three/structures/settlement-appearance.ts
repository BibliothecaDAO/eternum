import { orders } from "@bibliothecadao/types";
import {
  CanvasTexture,
  SRGBColorSpace,
  LinearFilter,
  ImageLoader,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import { MaterialPool } from "../utils/material-pool";

export const SETTLEMENT_RELATIONSHIPS = {
  owned: { label: "Owned · green", color: "#438b46" },
  allied: { label: "Allied · blue", color: "#387bc1" },
  enemy: { label: "Enemy / unowned · red", color: "#aa3028" },
} as const;
export type SettlementRelationship = keyof typeof SETTLEMENT_RELATIONSHIPS;
export const SETTLEMENT_RELATIONSHIP_ORDER = Object.keys(SETTLEMENT_RELATIONSHIPS) as SettlementRelationship[];

/** Relationship cloth is isolated from pooled materials; the model owns its clones. */
export class SettlementAppearance {
  private readonly cloth: MeshStandardMaterial[] = [];
  private readonly banners = new Set<MeshStandardMaterial>();
  private bannerTexture: CanvasTexture | null = null;
  private revision = 0;
  private disposed = false;

  constructor(source: Object3D, instances: readonly Mesh[]) {
    const surfaces = new Map<string, boolean>();
    source.traverse((node) => {
      if (node instanceof Mesh && (node.userData.relationshipCloth || node.userData.orderCloth)) {
        surfaces.set(
          node.geometry.uuid,
          node.userData.relationshipCloth === "banner" || node.userData.orderCloth === "banner",
        );
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
    this.bannerTexture ??= createBannerTexture();
    paintVillageBanner(this.bannerTexture, appearance.color);
    this.applyBannerTexture();
  }

  async setOrder(orderId: number | undefined): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.revision;
    this.bannerTexture ??= createBannerTexture();
    for (const material of this.cloth) material.color.set("#94a3b8");
    const canvas = this.bannerTexture.image as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Realm banner canvas is unavailable");
    context.fillStyle = "#94a3b8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    this.bannerTexture.needsUpdate = true;
    this.applyBannerTexture();
    if (orderId === undefined) return;
    const row = resolveRealmBannerRow(orderId);
    const order = orders[row];
    const artwork = (await loadOrderArtwork())[row];
    if (this.disposed || revision !== this.revision) return;
    for (const material of this.cloth) material.color.set(order.color);
    this.bannerTexture ??= createBannerTexture();
    paintOrderBanner(this.bannerTexture, order.color, artwork);
    this.applyBannerTexture();
  }

  private applyBannerTexture(): void {
    for (const material of this.banners) {
      material.color.set("#ffffff");
      material.map = this.bannerTexture;
      material.needsUpdate = true;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.revision++;
    this.bannerTexture?.dispose();
    this.bannerTexture = null;
    this.banners.clear();
    this.cloth.length = 0;
  }
}

function createBannerTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const texture = new CanvasTexture(canvas);
  texture.name = "Camp horned helmet imprint";
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
  drawCampHelmet(context);
  context.fillStyle = color;
  // Eye openings and the open lower face reveal the relationship-colored cloth.
  for (const side of [-1, 1]) {
    drawStampPolygon(context, [
      [128 + side * 14, 212],
      [128 + side * 47, 204],
      [128 + side * 43, 226],
      [128 + side * 18, 232],
    ]);
    context.fillRect(side < 0 ? 75 : 139, 188, 42, 5);
  }
  drawStampPolygon(context, [
    [80, 259],
    [114, 244],
    [114, 282],
    [80, 282],
  ]);
  drawStampPolygon(context, [
    [142, 244],
    [176, 259],
    [176, 282],
    [142, 282],
  ]);
  texture.needsUpdate = true;
}

function drawCampHelmet(context: CanvasRenderingContext2D): void {
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(128 + side * 53, 173);
    context.bezierCurveTo(128 + side * 99, 151, 128 + side * 114, 95, 128 + side * 85, 62);
    context.bezierCurveTo(128 + side * 94, 108, 128 + side * 63, 119, 128 + side * 42, 133);
    context.closePath();
    context.fill();
  }
  context.beginPath();
  context.moveTo(61, 195);
  context.bezierCurveTo(61, 148, 86, 119, 128, 111);
  context.bezierCurveTo(170, 119, 195, 148, 195, 195);
  context.lineTo(188, 255);
  context.lineTo(143, 278);
  context.lineTo(128, 296);
  context.lineTo(113, 278);
  context.lineTo(68, 255);
  context.closePath();
  context.fill();
}

function paintOrderBanner(texture: CanvasTexture, color: string, artwork: HTMLImageElement): void {
  const canvas = texture.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Realm banner canvas is unavailable");
  context.clearRect(0, 0, 256, 512);
  const scale = 172 / Math.max(artwork.width, artwork.height);
  const width = artwork.width * scale;
  const height = artwork.height * scale;
  context.drawImage(artwork, (256 - width) / 2, 205 - height / 2, width, height);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = "#f3e5c7";
  context.fillRect(0, 0, 256, 512);
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = color;
  context.fillRect(0, 0, 256, 512);
  context.globalCompositeOperation = "source-over";
  texture.name = "Realm order heraldry";
  texture.needsUpdate = true;
}

function drawStampPolygon(context: CanvasRenderingContext2D, points: readonly (readonly [number, number])[]): void {
  context.beginPath();
  context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
  context.closePath();
  context.fill();
}

/** Three fixed atlas rows keep each instanced village's cloth and emblem independent. */
export function createVillageBannerAtlas(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512 * SETTLEMENT_RELATIONSHIP_ORDER.length;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Village banner atlas canvas is unavailable");
  const stamp = createBannerTexture();
  for (const [row, relationship] of SETTLEMENT_RELATIONSHIP_ORDER.entries()) {
    paintVillageBanner(stamp, SETTLEMENT_RELATIONSHIPS[relationship].color);
    context.drawImage(stamp.image as HTMLCanvasElement, 0, row * 512);
  }
  stamp.dispose();
  const atlas = new CanvasTexture(canvas);
  atlas.name = "Village relationship banners";
  atlas.colorSpace = SRGBColorSpace;
  atlas.flipY = false;
  atlas.generateMipmaps = false;
  atlas.minFilter = LinearFilter;
  return atlas;
}

export function resolveSettlementRelationship(ownership: { isMine: boolean; isAlly: boolean }): SettlementRelationship {
  return ownership.isMine ? "owned" : ownership.isAlly ? "allied" : "enemy";
}

export const REALM_ATLAS_COLUMNS = 4;
export const REALM_NEUTRAL_ROW = orders.length;
export const REALM_ATLAS_ROWS = Math.ceil((orders.length + 1) / REALM_ATLAS_COLUMNS);
const orderRows = new Map(orders.map((order, index) => [order.orderId, index]));
let orderArtwork: Promise<HTMLImageElement[]> | undefined;

export function resolveRealmBannerRow(orderId: number | undefined): number {
  if (orderId === undefined) return REALM_NEUTRAL_ROW;
  const row = orderRows.get(orderId);
  if (row === undefined) throw new Error(`Unknown realm order: ${orderId}`);
  return row;
}

export function createRealmBannerAtlas(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = REALM_ATLAS_COLUMNS * 128;
  canvas.height = REALM_ATLAS_ROWS * 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Realm banner atlas canvas is unavailable");
  // Missing snapshot metadata has its own unmarked cloth, never another order's emblem.
  context.fillStyle = "#94a3b8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const atlas = new CanvasTexture(canvas);
  atlas.name = "Realm order banners";
  atlas.colorSpace = SRGBColorSpace;
  atlas.flipY = false;
  atlas.generateMipmaps = false;
  atlas.minFilter = LinearFilter;
  return atlas;
}

function loadOrderArtwork(): Promise<HTMLImageElement[]> {
  return (orderArtwork ??= Promise.all(
    orders.map((order) => new ImageLoader().loadAsync(`/images/orders/${order.orderName.toLowerCase()}.png`)),
  ).catch((error) => {
    orderArtwork = undefined;
    throw error;
  }));
}

export async function prepareRealmBannerAtlas(atlas: CanvasTexture): Promise<void> {
  const images = await loadOrderArtwork();
  const canvas = atlas.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Realm banner atlas canvas is unavailable");
  const stamp = createBannerTexture();
  for (const [index, order] of orders.entries()) {
    paintOrderBanner(stamp, order.color, images[index]);
    context.drawImage(
      stamp.image as HTMLCanvasElement,
      (index % REALM_ATLAS_COLUMNS) * 128,
      Math.floor(index / REALM_ATLAS_COLUMNS) * 256,
      128,
      256,
    );
  }
  stamp.dispose();
  atlas.needsUpdate = true;
}
