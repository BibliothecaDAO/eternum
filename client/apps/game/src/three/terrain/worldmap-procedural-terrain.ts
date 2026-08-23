import { NEUTRAL_BIOME_CLIMATE, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType, getNeighborHexes } from "@bibliothecadao/types";
import type { Group } from "three";

import { ProceduralTerrain, type TerrainPresentationDiagnostics } from "./procedural-terrain";
import { terrainCellKey } from "./terrain-coordinates";
import type { PreparedTerrainPage, TerrainCellInput, TerrainPageRequest, TerrainSurfaceSample } from "./terrain-types";
import type { TerrainPropLod } from "./terrain-prop-catalog";
import type { TerrainQualityTier } from "./terrain-quality";

interface WorldmapProceduralCell {
  biomeKey: string;
  col: number;
  occupied: boolean;
  row: number;
}

export interface WorldmapProceduralPresentationInput {
  cells: readonly WorldmapProceduralCell[];
  climate?: BiomeClimateConfig;
  generation: number;
  mapCenter: number;
  pageHeight: number;
  pageWidth: number;
  propDensityMultiplier?: number;
  subdivisions?: number;
}

export interface WorldmapProceduralPresentationDiagnostics extends TerrainPresentationDiagnostics {
  biomeMismatchCount: number;
  builtPages: number;
  commitMs: number;
  prepareMs: number;
  reusedPages: number;
}

interface CachedPreparedPage {
  prepared: PreparedTerrainPage;
  signature: string;
}

const BIOME_VALUES = new Set<string>(Object.values(BiomeType));

export class WorldmapProceduralTerrain {
  readonly object3d: Group;
  private readonly terrain = new ProceduralTerrain();
  private readonly preparedByPage = new Map<string, CachedPreparedPage>();
  private presentationRevision = 0;
  private visibleCellCount = 0;

  constructor() {
    this.object3d = this.terrain.object3d;
    this.object3d.name = "worldmap-procedural-terrain";
  }

  present(input: WorldmapProceduralPresentationInput): WorldmapProceduralPresentationDiagnostics {
    this.presentationRevision += 1;
    const requests = buildWorldmapTerrainPageRequests(input);
    const nextCache = new Map<string, CachedPreparedPage>();
    const preparedPages: PreparedTerrainPage[] = [];
    let builtPages = 0;
    let reusedPages = 0;

    for (const request of requests) {
      const signature = createRequestSignature(request);
      const retained = this.preparedByPage.get(request.pageKey);
      const prepared = retained?.signature === signature ? retained.prepared : this.terrain.preparePage(request);
      if (prepared === retained?.prepared) reusedPages += 1;
      else builtPages += 1;
      nextCache.set(request.pageKey, { prepared, signature });
      preparedPages.push(prepared);
    }

    return this.commitPreparedPages(input, preparedPages, nextCache, builtPages, reusedPages);
  }

  async presentAsync(
    input: WorldmapProceduralPresentationInput,
  ): Promise<WorldmapProceduralPresentationDiagnostics | null> {
    const revision = this.presentationRevision + 1;
    this.presentationRevision = revision;
    const requests = buildWorldmapTerrainPageRequests(input);
    let builtPages = 0;
    let reusedPages = 0;
    const preparedEntries = await Promise.all(
      requests.map(async (request) => {
        const signature = createRequestSignature(request);
        const retained = this.preparedByPage.get(request.pageKey);
        if (retained?.signature === signature) {
          reusedPages += 1;
          return [request.pageKey, retained] as const;
        }
        builtPages += 1;
        const prepared = await this.terrain.preparePageAsync(request);
        return [request.pageKey, { prepared, signature }] as const;
      }),
    );
    if (revision !== this.presentationRevision) return null;
    const nextCache = new Map<string, CachedPreparedPage>(preparedEntries);
    const preparedPages = preparedEntries.map(([, entry]) => entry.prepared);
    return this.commitPreparedPages(input, preparedPages, nextCache, builtPages, reusedPages);
  }

  loadProps(): Promise<void> {
    return this.terrain.loadProps();
  }

  loadGroundTextures(): Promise<void> {
    return this.terrain.loadGroundTextures();
  }

  setPropLod(lod: TerrainPropLod): void {
    this.terrain.setPropLod(lod);
  }

  setGroundTextureDetailEnabled(enabled: boolean): void {
    this.terrain.setGroundTextureDetailEnabled(enabled);
  }

  setQualityTier(tier: TerrainQualityTier): void {
    this.terrain.setQualityTier(tier);
  }

  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample {
    return this.terrain.sampleSurface(worldX, worldZ);
  }

  getVisibleCellCount(): number {
    return this.visibleCellCount;
  }

  clear(): void {
    this.presentationRevision += 1;
    this.terrain.present([]);
    this.preparedByPage.clear();
    this.visibleCellCount = 0;
  }

  dispose(): void {
    this.presentationRevision += 1;
    this.preparedByPage.clear();
    this.visibleCellCount = 0;
    this.terrain.dispose();
  }

  private commitPreparedPages(
    input: WorldmapProceduralPresentationInput,
    preparedPages: PreparedTerrainPage[],
    nextCache: Map<string, CachedPreparedPage>,
    builtPages: number,
    reusedPages: number,
  ): WorldmapProceduralPresentationDiagnostics {
    const commitStartedAt = performance.now();
    const presentation = this.terrain.present(preparedPages);
    const commitMs = performance.now() - commitStartedAt;
    this.preparedByPage.clear();
    nextCache.forEach((page, pageKey) => this.preparedByPage.set(pageKey, page));
    this.visibleCellCount = input.cells.filter((cell) => resolveBiomeKey(cell.biomeKey) !== null).length;
    const diagnostics = preparedPages.reduce(
      (summary, page) => ({
        biomeMismatchCount: summary.biomeMismatchCount + page.diagnostics.biomeMismatchCount,
        prepareMs: summary.prepareMs + page.diagnostics.prepareMs,
      }),
      { biomeMismatchCount: 0, prepareMs: 0 },
    );
    if (import.meta.env.DEV && diagnostics.biomeMismatchCount > 0) {
      console.warn("[ProceduralTerrain] Projected biome/environment mismatches", {
        count: diagnostics.biomeMismatchCount,
      });
    }
    return { ...presentation, ...diagnostics, builtPages, commitMs, reusedPages };
  }
}

export function buildWorldmapTerrainPageRequests(input: WorldmapProceduralPresentationInput): TerrainPageRequest[] {
  requirePageSize(input.pageWidth, "width");
  requirePageSize(input.pageHeight, "height");
  const cells = canonicalTerrainCells(input.cells.map(toTerrainCell));
  const cellsByKey = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
  const cellsByPage = new Map<string, TerrainCellInput[]>();

  for (const cell of cells) {
    const pageKey = resolvePageKey(cell.col, cell.row, input.pageWidth, input.pageHeight);
    const pageCells = cellsByPage.get(pageKey) ?? [];
    pageCells.push(cell);
    cellsByPage.set(pageKey, pageCells);
  }

  return Array.from(cellsByPage.entries())
    .toSorted(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))
    .map(([pageKey, pageCells]) => ({
      cells: canonicalTerrainCells(pageCells),
      climate: input.climate ?? NEUTRAL_BIOME_CLIMATE,
      generation: input.generation,
      halo: resolvePageHalo(pageCells, cellsByKey),
      mapCenter: input.mapCenter,
      pageKey,
      propDensityMultiplier: input.propDensityMultiplier,
      strictBiomeParity: false,
      subdivisions: input.subdivisions ?? 2,
    }));
}

function resolvePageHalo(
  pageCells: readonly TerrainCellInput[],
  cellsByKey: ReadonlyMap<string, TerrainCellInput>,
): TerrainCellInput[] {
  const ownedKeys = new Set(pageCells.map((cell) => terrainCellKey(cell.col, cell.row)));
  const haloByKey = new Map<string, TerrainCellInput>();
  for (const cell of pageCells) {
    for (const neighbor of getNeighborHexes(cell.col, cell.row)) {
      const key = terrainCellKey(neighbor.col, neighbor.row);
      const candidate = cellsByKey.get(key);
      if (candidate && !ownedKeys.has(key)) haloByKey.set(key, candidate);
    }
  }
  return canonicalTerrainCells(Array.from(haloByKey.values()));
}

function toTerrainCell(cell: WorldmapProceduralCell): TerrainCellInput {
  return {
    biome: resolveBiomeKey(cell.biomeKey),
    col: cell.col,
    occupied: cell.occupied,
    row: cell.row,
  };
}

function resolveBiomeKey(biomeKey: string): BiomeType | null {
  if (biomeKey === "Outline" || biomeKey === "Empty") return null;
  const normalized = biomeKey.endsWith("Alt") ? biomeKey.slice(0, -3) : biomeKey;
  return BIOME_VALUES.has(normalized) && normalized !== BiomeType.None ? (normalized as BiomeType) : null;
}

function resolvePageKey(col: number, row: number, pageWidth: number, pageHeight: number): string {
  const startCol = Math.floor(col / pageWidth) * pageWidth;
  const startRow = Math.floor(row / pageHeight) * pageHeight;
  return `${startRow},${startCol}`;
}

function canonicalTerrainCells(cells: readonly TerrainCellInput[]): TerrainCellInput[] {
  return cells.toSorted((left, right) => left.row - right.row || left.col - right.col);
}

function createRequestSignature(request: TerrainPageRequest): string {
  return JSON.stringify({
    cells: request.cells,
    climate: request.climate,
    generation: request.generation,
    halo: request.halo,
    mapCenter: request.mapCenter,
    propDensityMultiplier: request.propDensityMultiplier,
    subdivisions: request.subdivisions,
  });
}

function requirePageSize(value: number, axis: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Worldmap procedural terrain page ${axis} must be a positive integer`);
  }
}
