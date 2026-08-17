import * as THREE from "three";
import type { CompactEntityLabelVariant } from "./compact-entity-label-policy";

export interface CompactLabelAtlasRecord {
  geometry: THREE.PlaneGeometry;
  height: number;
  key: string;
  material: THREE.MeshBasicMaterial;
  width: number;
}

interface CompactEntityLabelStyle {
  background: string;
  border: string;
  text: string;
}

interface AtlasPage {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  material: THREE.MeshBasicMaterial;
  occupiedCells: boolean[];
  recordCount: number;
  texture: THREE.CanvasTexture;
}

interface AtlasRecord extends CompactLabelAtlasRecord {
  page: AtlasPage;
  references: number;
  slot: AtlasSlot;
}

interface AtlasSlot {
  cellCount: number;
  cellIndex: number;
  x: number;
  y: number;
}

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

const ATLAS_TEXTURE_SIZE = 2_048;
const LABEL_FONT_SIZE = 16;
const LABEL_FONT = `${LABEL_FONT_SIZE}px Cinzel, serif`;
const LABEL_PADDING_X = 12;
const LABEL_RADIUS = 10;
const LABEL_HEIGHT = 34;
const LABEL_MAX_WIDTH = 190;
const LABEL_MIN_WIDTH = 72;
const CELL_WIDTH = 96;
const CELL_HEIGHT = 36;

class CompactEntityLabelAtlas {
  private readonly pages: AtlasPage[] = [];
  private readonly records = new Map<string, AtlasRecord>();
  private readonly pendingUploads = new Set<AtlasPage>();
  private uploadScheduled = false;
  private readonly pixelRatio = resolveDevicePixelRatio();
  private readonly logicalPageSize = ATLAS_TEXTURE_SIZE / this.pixelRatio;
  private readonly columns = Math.floor(this.logicalPageSize / CELL_WIDTH);
  private readonly rows = Math.floor(this.logicalPageSize / CELL_HEIGHT);

  public acquire(text: string, variant: CompactEntityLabelVariant): CompactLabelAtlasRecord {
    const key = `${variant}:${text}`;
    const existing = this.records.get(key);
    if (existing) {
      existing.references += 1;
      return existing;
    }

    const width = this.measureLabelWidth(text);
    const cellCount = Math.ceil(width / CELL_WIDTH);
    const { page, slot } = this.allocateSlot(cellCount);
    this.drawLabel(page, slot, text, width, LABEL_STYLES[variant]);
    const record: AtlasRecord = {
      geometry: createLabelGeometry(slot, width, LABEL_HEIGHT, this.logicalPageSize),
      height: LABEL_HEIGHT,
      key,
      material: page.material,
      page,
      references: 1,
      slot,
      width,
    };
    page.recordCount += 1;
    this.records.set(key, record);
    this.scheduleUpload(page);
    return record;
  }

  public release(record: CompactLabelAtlasRecord): void {
    const tracked = this.records.get(record.key);
    if (!tracked) return;

    tracked.references -= 1;
    if (tracked.references > 0) return;

    tracked.geometry.dispose();
    this.clearSlot(tracked.page, tracked.slot);
    this.releaseSlot(tracked.page, tracked.slot);
    tracked.page.recordCount -= 1;
    this.records.delete(tracked.key);
    if (tracked.page.recordCount === 0) this.disposePage(tracked.page);
    else this.scheduleUpload(tracked.page);
  }

  private measureLabelWidth(text: string): number {
    const context = this.pages[0]?.context ?? createCanvasContextForMeasurement();
    const measuredWidth = context ? Math.ceil(measureTextWidth(context, text)) : text.length * 10;
    return Math.min(LABEL_MAX_WIDTH, Math.max(LABEL_MIN_WIDTH, measuredWidth + LABEL_PADDING_X * 2));
  }

  private allocateSlot(cellCount: number): { page: AtlasPage; slot: AtlasSlot } {
    for (const page of this.pages) {
      const slot = this.findFreeSlot(page, cellCount);
      if (slot) return { page, slot };
    }

    const page = this.createPage();
    const slot = this.findFreeSlot(page, cellCount);
    if (!slot) throw new Error("Compact label atlas page cannot fit one label");
    return { page, slot };
  }

  private findFreeSlot(page: AtlasPage, cellCount: number): AtlasSlot | null {
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column <= this.columns - cellCount; column += 1) {
        const cellIndex = row * this.columns + column;
        const available = Array.from(
          { length: cellCount },
          (_, offset) => !page.occupiedCells[cellIndex + offset],
        ).every(Boolean);
        if (!available) continue;

        for (let offset = 0; offset < cellCount; offset += 1) page.occupiedCells[cellIndex + offset] = true;
        return { cellCount, cellIndex, x: column * CELL_WIDTH, y: row * CELL_HEIGHT };
      }
    }
    return null;
  }

  private releaseSlot(page: AtlasPage, slot: AtlasSlot): void {
    for (let offset = 0; offset < slot.cellCount; offset += 1) {
      page.occupiedCells[slot.cellIndex + offset] = false;
    }
  }

  private createPage(): AtlasPage {
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_TEXTURE_SIZE;
    canvas.height = ATLAS_TEXTURE_SIZE;
    const context = canvas.getContext("2d");
    context?.scale?.(this.pixelRatio, this.pixelRatio);
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = `compact-label-atlas-${this.pages.length}`;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      alphaTest: 0.05,
      depthTest: false,
      depthWrite: false,
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
    });
    const page = {
      canvas,
      context,
      material,
      occupiedCells: Array.from({ length: this.columns * this.rows }, () => false),
      recordCount: 0,
      texture,
    };
    this.pages.push(page);
    return page;
  }

  private drawLabel(
    page: AtlasPage,
    slot: AtlasSlot,
    text: string,
    width: number,
    style: CompactEntityLabelStyle,
  ): void {
    const context = page.context;
    if (!context) return;

    context.clearRect(slot.x, slot.y, slot.cellCount * CELL_WIDTH, CELL_HEIGHT);
    context.fillStyle = style.background;
    context.strokeStyle = style.border;
    context.lineWidth = 2;
    drawRoundedRect(context, slot.x + 1, slot.y + 1, width - 2, LABEL_HEIGHT - 2, LABEL_RADIUS);
    context.fill();
    context.stroke();
    context.font = LABEL_FONT;
    context.fillStyle = style.text;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      truncateLabelText(context, text, width - LABEL_PADDING_X * 2),
      slot.x + width / 2,
      slot.y + LABEL_HEIGHT / 2 + 1,
    );
  }

  private clearSlot(page: AtlasPage, slot: AtlasSlot): void {
    page.context?.clearRect(slot.x, slot.y, slot.cellCount * CELL_WIDTH, CELL_HEIGHT);
  }

  private scheduleUpload(page: AtlasPage): void {
    this.pendingUploads.add(page);
    if (this.uploadScheduled) return;

    this.uploadScheduled = true;
    scheduleNextFrame(() => {
      this.uploadScheduled = false;
      this.pendingUploads.forEach((pendingPage) => {
        pendingPage.texture.needsUpdate = true;
      });
      this.pendingUploads.clear();
    });
  }

  private disposePage(page: AtlasPage): void {
    this.pendingUploads.delete(page);
    page.material.dispose();
    page.texture.dispose();
    const index = this.pages.indexOf(page);
    if (index >= 0) this.pages.splice(index, 1);
  }
}

const compactEntityLabelAtlas = new CompactEntityLabelAtlas();

export function acquireCompactLabel(text: string, variant: CompactEntityLabelVariant): CompactLabelAtlasRecord {
  return compactEntityLabelAtlas.acquire(text, variant);
}

export function releaseCompactLabel(record: CompactLabelAtlasRecord): void {
  compactEntityLabelAtlas.release(record);
}

function createLabelGeometry(
  slot: AtlasSlot,
  width: number,
  height: number,
  logicalPageSize: number,
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uv = geometry.getAttribute("uv");
  const uMin = slot.x / logicalPageSize;
  const uMax = (slot.x + width) / logicalPageSize;
  const vMin = 1 - (slot.y + height) / logicalPageSize;
  const vMax = 1 - slot.y / logicalPageSize;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, uMin + uv.getX(index) * (uMax - uMin), vMin + uv.getY(index) * (vMax - vMin));
  }
  uv.needsUpdate = true;
  return geometry;
}

function createCanvasContextForMeasurement(): CanvasRenderingContext2D | null {
  return document.createElement("canvas").getContext("2d");
}

function measureTextWidth(context: CanvasRenderingContext2D, text: string): number {
  context.font = LABEL_FONT;
  return context.measureText(text).width;
}

function truncateLabelText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 1 && context.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated.trim()}...`;
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

function scheduleNextFrame(task: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => task());
    return;
  }
  queueMicrotask(task);
}

function resolveDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}
