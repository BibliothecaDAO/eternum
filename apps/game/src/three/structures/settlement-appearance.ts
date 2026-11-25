import { ASPECT_HEX } from "@/tokens";
import { createCanvasTexture } from "../utils/canvas-texture";
import { iconUrl, orderMeaning } from "@/ui/design-system/icon-meaning";
import { aspects, orders, type AspectId } from "@bibliothecadao/types";
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
  enemy: { label: "Not owned · red", color: "#aa3028" },
} as const;
export type SettlementRelationship = keyof typeof SETTLEMENT_RELATIONSHIPS;
export const SETTLEMENT_RELATIONSHIP_ORDER = Object.keys(SETTLEMENT_RELATIONSHIPS) as SettlementRelationship[];
export const VILLAGE_BANNER_ROWS = SETTLEMENT_RELATIONSHIP_ORDER.length + aspects.length;

export function resolveVillageAspectRow(aspect: AspectId): number {
  const index = aspects.findIndex((entry) => entry.id === aspect);
  if (index < 0) throw new Error(`Unknown aspect: ${aspect}`);
  return SETTLEMENT_RELATIONSHIP_ORDER.length + index;
}

/** Relationship cloth is isolated from pooled materials; the model owns its clones. */
export class SettlementAppearance {
  private readonly cloth: MeshStandardMaterial[] = [];
  private readonly banners = new Set<MeshStandardMaterial>();
  private bannerTexture: CanvasTexture | null = null;
  private relationship: SettlementRelationship = "enemy";
  private readonly isRealm: boolean;
  private artwork?: HTMLImageElement;
  private revision = 0;
  private disposed = false;

  constructor(source: Object3D, instances: readonly Mesh[]) {
    const surfaces = new Map<string, boolean>();
    let isRealm = false;
    source.traverse((node) => {
      if (node instanceof Mesh && (node.userData.relationshipCloth || node.userData.orderCloth)) {
        isRealm ||= Boolean(node.userData.orderCloth);
        surfaces.set(
          node.geometry.uuid,
          node.userData.relationshipCloth === "banner" || node.userData.orderCloth === "banner",
        );
      }
    });
    this.isRealm = isRealm;
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
    if (this.disposed) return;
    this.relationship = relationship;
    for (const material of this.cloth) material.color.set(appearance.color);
    if (this.banners.size === 0) return;
    this.bannerTexture ??= createBannerTexture();
    if (this.isRealm) paintOrderBanner(this.bannerTexture, appearance.color, this.artwork);
    else paintVillageBanner(this.bannerTexture, appearance.color);
    this.applyBannerTexture();
  }

  async setOrder(orderId: number | undefined): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.revision;
    this.artwork = undefined;
    this.setRelationship(this.relationship);
    if (orderId === undefined) return;
    const row = resolveOrderRow(orderId);
    const artwork = (await loadOrderArtwork())[row];
    if (this.disposed || revision !== this.revision) return;
    this.artwork = artwork;
    this.setRelationship(this.relationship);
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
  const { texture } = createCanvasTexture(256, 512);
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

function paintOrderBanner(texture: CanvasTexture, color: string, artwork?: HTMLImageElement): void {
  const canvas = texture.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Realm banner canvas is unavailable");
  context.clearRect(0, 0, 256, 512);
  if (artwork) {
    const scale = 172 / Math.max(artwork.width, artwork.height);
    const width = artwork.width * scale;
    const height = artwork.height * scale;
    context.drawImage(artwork, (256 - width) / 2, 205 - height / 2, width, height);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "#f3e5c7";
    context.fillRect(0, 0, 256, 512);
  }
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

/** Two fixed atlas rows keep each instanced village's cloth and emblem independent. */
export function createVillageBannerAtlas(): CanvasTexture {
  const { texture: atlas, context } = createCanvasTexture(256, 512 * VILLAGE_BANNER_ROWS);
  if (!context) throw new Error("Village banner atlas canvas is unavailable");
  const stamp = createBannerTexture();
  for (const [row, relationship] of SETTLEMENT_RELATIONSHIP_ORDER.entries()) {
    paintVillageBanner(stamp, SETTLEMENT_RELATIONSHIPS[relationship].color);
    context.drawImage(stamp.image as HTMLCanvasElement, 0, row * 512);
  }
  for (const aspect of aspects) {
    paintVillageBanner(stamp, ASPECT_HEX[aspect.id]);
    context.drawImage(stamp.image as HTMLCanvasElement, 0, resolveVillageAspectRow(aspect.id) * 512);
  }
  stamp.dispose();
  atlas.name = "Village relationship banners";
  atlas.colorSpace = SRGBColorSpace;
  atlas.flipY = false;
  atlas.generateMipmaps = false;
  atlas.minFilter = LinearFilter;
  return atlas;
}

export function resolveSettlementRelationship(isMine: boolean): SettlementRelationship {
  return isMine ? "owned" : "enemy";
}

export const REALM_ATLAS_COLUMNS = 4;
const REALM_NEUTRAL_ROW = orders.length;
const REALM_GROUP_ROWS = Math.ceil((orders.length + 1) / REALM_ATLAS_COLUMNS);
export const REALM_BANNER_GROUP_SIZE = REALM_GROUP_ROWS * REALM_ATLAS_COLUMNS;
export const REALM_ATLAS_ROWS = REALM_GROUP_ROWS * SETTLEMENT_RELATIONSHIP_ORDER.length;
const orderRows = new Map(orders.map((order, index) => [order.orderId, index]));
let orderArtwork: Promise<HTMLImageElement[]> | undefined;

function resolveOrderRow(orderId: number): number {
  const row = orderRows.get(orderId);
  if (row === undefined) throw new Error(`Unknown realm order: ${orderId}`);
  return row;
}

export function resolveRealmBannerRow(
  orderId: number | undefined,
  relationship: SettlementRelationship = "enemy",
): number {
  const row = orderId === undefined ? REALM_NEUTRAL_ROW : resolveOrderRow(orderId);
  return row + SETTLEMENT_RELATIONSHIP_ORDER.indexOf(relationship) * REALM_BANNER_GROUP_SIZE;
}

export function createRealmBannerAtlas(): CanvasTexture {
  const { texture: atlas, context } = createCanvasTexture(REALM_ATLAS_COLUMNS * 128, REALM_ATLAS_ROWS * 256);
  if (!context) throw new Error("Realm banner atlas canvas is unavailable");
  const canvas = atlas.image as HTMLCanvasElement;
  // Missing order metadata leaves unmarked cloth in the current ownership color.
  for (const [group, relationship] of SETTLEMENT_RELATIONSHIP_ORDER.entries()) {
    context.fillStyle = SETTLEMENT_RELATIONSHIPS[relationship].color;
    context.fillRect(0, group * REALM_GROUP_ROWS * 256, canvas.width, REALM_GROUP_ROWS * 256);
  }
  atlas.name = "Realm order banners";
  atlas.colorSpace = SRGBColorSpace;
  atlas.flipY = false;
  atlas.generateMipmaps = false;
  atlas.minFilter = LinearFilter;
  return atlas;
}

export function loadOrderArtwork(): Promise<HTMLImageElement[]> {
  return (orderArtwork ??= Promise.all(
    orders.map((order) => new ImageLoader().loadAsync(iconUrl(orderMeaning(order.orderId), 256))),
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
  for (const relationship of SETTLEMENT_RELATIONSHIP_ORDER) {
    for (const [index, order] of [...orders, undefined].entries()) {
      const row = resolveRealmBannerRow(order?.orderId, relationship);
      paintOrderBanner(stamp, SETTLEMENT_RELATIONSHIPS[relationship].color, images[index]);
      context.drawImage(
        stamp.image as HTMLCanvasElement,
        (row % REALM_ATLAS_COLUMNS) * 128,
        Math.floor(row / REALM_ATLAS_COLUMNS) * 256,
        128,
        256,
      );
    }
  }
  stamp.dispose();
  atlas.needsUpdate = true;
}
