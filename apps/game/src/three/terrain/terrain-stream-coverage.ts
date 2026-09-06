import { ClampToEdgeWrapping, DataTexture, LinearFilter, RedFormat, UnsignedByteType, Vector4 } from "three";
import { uniform } from "three/tsl";
import type { TerrainPageRequest } from "./terrain-types";

const REVEAL_SECONDS = 0.4;
const MAX_MASK_SIZE = 1024;

interface LoadedPage {
  cells: TerrainPageRequest["cells"];
  progress: number;
}

/** A small camera-window mask: zero until geometry commits, then a bounded fade to loaded. */
export class TerrainStreamCoverage {
  readonly bounds = uniform(new Vector4(0, 0, 1, 1));
  readonly texture = new DataTexture(new Uint8Array(1), 1, 1, RedFormat, UnsignedByteType);
  private readonly pages = new Map<string, LoadedPage>();
  private minCol = 0;
  private minRow = 0;
  private width = 1;
  private height = 1;
  private reducedMotion = false;

  constructor() {
    this.texture.name = "terrain-loaded-coverage";
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.wrapS = this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.flipY = true;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  commit(requests: readonly TerrainPageRequest[]): void {
    const retained = new Set(requests.map((request) => request.pageKey));
    let changed = false;
    this.pages.forEach((_page, key) => {
      if (retained.has(key)) return;
      this.pages.delete(key);
      changed = true;
    });
    for (const request of requests) {
      const previous = this.pages.get(request.pageKey);
      if (previous) {
        if (previous.cells !== request.cells && hasChangedCoverage(previous.cells, request.cells)) {
          previous.cells = request.cells;
          changed = true;
        }
        continue;
      }
      this.pages.set(request.pageKey, { cells: request.cells, progress: this.reducedMotion ? 1 : 0 });
      changed = true;
    }
    if (changed) this.rebuild();
  }

  update(deltaSeconds: number): void {
    let changed = false;
    this.pages.forEach((page) => {
      if (page.progress === 1) return;
      page.progress = this.reducedMotion ? 1 : Math.min(1, page.progress + Math.max(0, deltaSeconds) / REVEAL_SECONDS);
      this.writePage(page);
      changed = true;
    });
    if (changed) this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.pages.clear();
    this.texture.dispose();
  }

  private rebuild(): void {
    const { minCol, minRow, width, height } = resolveCoverageLayout(this.pages.values());
    this.minCol = minCol;
    this.minRow = minRow;
    if (width > MAX_MASK_SIZE || height > MAX_MASK_SIZE)
      throw new Error("Terrain coverage exceeds camera window capacity");
    if (width !== this.width || height !== this.height) this.texture.dispose();
    this.width = width;
    this.height = height;
    this.texture.image = { data: new Uint8Array(width * height), width, height };
    this.bounds.value.set(this.minCol - 0.5, this.minRow - 0.5, width, height);
    this.pages.forEach((page) => this.writePage(page));
    this.texture.needsUpdate = true;
  }

  private writePage(page: LoadedPage): void {
    const value = Math.round(page.progress * page.progress * (3 - 2 * page.progress) * 255);
    const data = this.texture.image.data as Uint8Array;
    page.cells.forEach(({ col, row }) => {
      data[(row - this.minRow) * this.width + col - this.minCol] = value;
    });
  }
}

function hasChangedCoverage(previous: TerrainPageRequest["cells"], next: TerrainPageRequest["cells"]): boolean {
  return (
    previous.length !== next.length ||
    previous.some((cell, index) => cell.col !== next[index].col || cell.row !== next[index].row)
  );
}

function resolveCoverageLayout(pages: Iterable<LoadedPage>) {
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { cells } of pages) {
    for (const { col, row } of cells) {
      minCol = Math.min(minCol, col);
      minRow = Math.min(minRow, row);
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);
    }
  }
  if (!Number.isFinite(minCol)) return { minCol: 0, minRow: 0, width: 1, height: 1 };
  // Empty border texels stop filtering from exposing unloaded ground outside the window.
  return { minCol: minCol - 1, minRow: minRow - 1, width: maxCol - minCol + 3, height: maxRow - minRow + 3 };
}
