import type { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import type { CompactEntityLabelVariant } from "./compact-entity-label-policy";

interface CompactLabelTextureRecord {
  height: number;
  references: number;
  texture: THREE.CanvasTexture;
  width: number;
}

interface ActiveCompactLabel {
  baseRenderOrder: number;
  cacheKey: string;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  size: number;
}

export interface CompactEntityLabelInput {
  entityId: ID;
  position: THREE.Vector3;
  text: string;
  variant: CompactEntityLabelVariant;
  priority?: number;
  size?: number;
}

interface CompactEntityLabelStyle {
  background: string;
  border: string;
  text: string;
}

const COMPACT_LABEL_RENDER_ORDER = 10_050;
const DEFAULT_LABEL_SIZE = 0.46;
const HOVER_LABEL_SCALE = 1.12;
const LABEL_FONT_SIZE = 16;
const LABEL_FONT = `${LABEL_FONT_SIZE}px Cinzel, serif`;
const LABEL_PADDING_X = 12;
const LABEL_PADDING_Y = 6;
const LABEL_RADIUS = 10;
const LABEL_HEIGHT = 34;
const LABEL_MAX_WIDTH = 190;

const LABEL_STYLES: Record<CompactEntityLabelVariant, CompactEntityLabelStyle> = {
  agent: {
    background: "rgba(41, 28, 68, 0.82)",
    border: "rgba(216, 180, 254, 0.85)",
    text: "#f3e8ff",
  },
  ally: {
    background: "rgba(22, 72, 84, 0.78)",
    border: "rgba(103, 232, 249, 0.78)",
    text: "#ecfeff",
  },
  enemy: {
    background: "rgba(85, 29, 29, 0.78)",
    border: "rgba(252, 165, 165, 0.78)",
    text: "#fff1f2",
  },
  mine: {
    background: "rgba(76, 52, 16, 0.82)",
    border: "rgba(251, 191, 36, 0.86)",
    text: "#fff7ed",
  },
  neutral: {
    background: "rgba(38, 38, 38, 0.76)",
    border: "rgba(212, 212, 212, 0.64)",
    text: "#fafafa",
  },
  structure: {
    background: "rgba(30, 41, 59, 0.78)",
    border: "rgba(203, 213, 225, 0.68)",
    text: "#f8fafc",
  },
};

export class CompactEntityLabelRenderer {
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly labels = new Map<ID, ActiveCompactLabel>();
  private readonly group = new THREE.Group();
  private readonly textureCache = new Map<string, CompactLabelTextureRecord>();
  private hoveredEntityId?: ID;

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = "compact-entity-labels";
    this.group.renderOrder = COMPACT_LABEL_RENDER_ORDER;
    this.scene.add(this.group);
  }

  public setLabel(input: CompactEntityLabelInput): void {
    const text = normalizeLabelText(input.text);
    if (text.length === 0) {
      this.removeLabel(input.entityId);
      return;
    }

    const size = input.size ?? DEFAULT_LABEL_SIZE;
    const cacheKey = buildTextureCacheKey(text, input.variant);
    const existingLabel = this.labels.get(input.entityId);

    if (existingLabel && existingLabel.cacheKey === cacheKey) {
      const textureRecord = this.textureCache.get(cacheKey);
      if (!textureRecord) {
        this.removeLabel(input.entityId);
        this.setLabel(input);
        return;
      }
      existingLabel.size = size;
      existingLabel.baseRenderOrder = COMPACT_LABEL_RENDER_ORDER + (input.priority ?? 0);
      existingLabel.mesh.position.copy(input.position);
      existingLabel.mesh.renderOrder =
        this.hoveredEntityId === input.entityId ? existingLabel.baseRenderOrder + 100 : existingLabel.baseRenderOrder;
      this.applyLabelScale(existingLabel, textureRecord);
      return;
    }

    if (existingLabel) {
      this.releaseActiveLabel(input.entityId, existingLabel);
    }

    const textureRecord = this.acquireTexture(cacheKey, text, input.variant);
    const material = new THREE.MeshBasicMaterial({
      alphaTest: 0.05,
      depthTest: false,
      depthWrite: false,
      map: textureRecord.texture,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    const baseRenderOrder = COMPACT_LABEL_RENDER_ORDER + (input.priority ?? 0);
    const label = {
      baseRenderOrder,
      cacheKey,
      material,
      mesh,
      size,
    };

    mesh.name = `compact-entity-label-${input.entityId}`;
    mesh.raycast = () => {};
    mesh.position.copy(input.position);
    mesh.renderOrder = baseRenderOrder;
    this.applyLabelScale(label, textureRecord);

    this.labels.set(input.entityId, label);
    this.group.add(mesh);
  }

  public removeLabel(entityId: ID): void {
    const label = this.labels.get(entityId);
    if (!label) {
      return;
    }

    this.releaseActiveLabel(entityId, label);
  }

  public removeMany(entityIds: Iterable<ID>): void {
    for (const entityId of entityIds) {
      this.removeLabel(entityId);
    }
  }

  public clear(): void {
    for (const [entityId, label] of this.labels) {
      this.releaseActiveLabel(entityId, label);
    }
    this.hoveredEntityId = undefined;
  }

  public setHover(entityId: ID): void {
    if (this.hoveredEntityId === entityId) {
      return;
    }

    this.clearHover();
    const label = this.labels.get(entityId);
    if (!label) {
      return;
    }

    this.hoveredEntityId = entityId;
    label.mesh.scale.multiplyScalar(HOVER_LABEL_SCALE);
    label.mesh.renderOrder = label.baseRenderOrder + 100;
  }

  public clearHover(): void {
    if (this.hoveredEntityId === undefined) {
      return;
    }

    const label = this.labels.get(this.hoveredEntityId);
    if (label) {
      const textureRecord = this.textureCache.get(label.cacheKey);
      if (textureRecord) {
        this.applyLabelScale(label, textureRecord);
      }
      label.mesh.renderOrder = label.baseRenderOrder;
    }
    this.hoveredEntityId = undefined;
  }

  public updateCamera(camera: THREE.Camera): void {
    for (const label of this.labels.values()) {
      label.mesh.quaternion.copy(camera.quaternion);
    }
  }

  public dispose(): void {
    this.clear();
    this.geometry.dispose();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  private acquireTexture(
    cacheKey: string,
    text: string,
    variant: CompactEntityLabelVariant,
  ): CompactLabelTextureRecord {
    const existing = this.textureCache.get(cacheKey);
    if (existing) {
      existing.references += 1;
      return existing;
    }

    const textureRecord = createLabelTextureRecord(text, LABEL_STYLES[variant]);
    this.textureCache.set(cacheKey, textureRecord);
    return textureRecord;
  }

  private releaseActiveLabel(entityId: ID, label: ActiveCompactLabel): void {
    this.group.remove(label.mesh);
    label.material.dispose();
    this.releaseTexture(label.cacheKey);
    this.labels.delete(entityId);

    if (this.hoveredEntityId === entityId) {
      this.hoveredEntityId = undefined;
    }
  }

  private releaseTexture(cacheKey: string): void {
    const textureRecord = this.textureCache.get(cacheKey);
    if (!textureRecord) {
      return;
    }

    textureRecord.references -= 1;
    if (textureRecord.references > 0) {
      return;
    }

    textureRecord.texture.dispose();
    this.textureCache.delete(cacheKey);
  }

  private applyLabelScale(label: ActiveCompactLabel, textureRecord: CompactLabelTextureRecord): void {
    const aspectRatio = textureRecord.width / textureRecord.height;
    label.mesh.scale.set(label.size * aspectRatio, label.size, 1);
  }
}

function createLabelTextureRecord(text: string, style: CompactEntityLabelStyle): CompactLabelTextureRecord {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const pixelRatio = resolveDevicePixelRatio();
  const measuredWidth = context ? Math.ceil(measureLabelWidth(context, text)) : text.length * 10;
  const width = Math.min(LABEL_MAX_WIDTH, Math.max(72, measuredWidth + LABEL_PADDING_X * 2));
  const height = LABEL_HEIGHT;

  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(height * pixelRatio);

  if (context) {
    context.scale?.(pixelRatio, pixelRatio);
    drawLabelBackground(context, width, height, style);
    drawLabelText(context, text, width, style);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    height,
    references: 1,
    texture,
    width,
  };
}

function drawLabelBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: CompactEntityLabelStyle,
): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = style.background;
  context.strokeStyle = style.border;
  context.lineWidth = 2;
  drawRoundedRect(context, 1, 1, width - 2, height - 2, LABEL_RADIUS);
  context.fill();
  context.stroke();
}

function drawLabelText(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  style: CompactEntityLabelStyle,
): void {
  context.font = LABEL_FONT;
  context.fillStyle = style.text;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(truncateLabelText(context, text, width - LABEL_PADDING_X * 2), width / 2, LABEL_HEIGHT / 2 + 1);
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  if (typeof context.roundRect === "function") {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.closePath();
    return;
  }

  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function measureLabelWidth(context: CanvasRenderingContext2D, text: string): number {
  context.font = LABEL_FONT;
  return context.measureText(text).width;
}

function truncateLabelText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 1 && context.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated.trim()}...`;
}

function normalizeLabelText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function buildTextureCacheKey(text: string, variant: CompactEntityLabelVariant): string {
  return `${variant}:${text}`;
}

function resolveDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}
