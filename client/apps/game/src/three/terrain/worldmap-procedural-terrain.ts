import { NEUTRAL_BIOME_CLIMATE, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType, getNeighborHexes } from "@bibliothecadao/types";
import type { Group } from "three";

import { ProceduralTerrain, type TerrainPresentationDiagnostics } from "./procedural-terrain";
import type { TerrainFogMask } from "./terrain-fog-mask";
import { terrainCellKey } from "./terrain-coordinates";
import { terrainHexToWorld } from "./terrain-coordinates";
import { buildTerrainRoadSegments } from "./terrain-roads";
import { MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS } from "./terrain-settlements";
import type {
  PreparedTerrainPage,
  TerrainCellInput,
  TerrainPageRequest,
  TerrainRoadAnchor,
  TerrainRoadSegment,
  TerrainSettlementAnchor,
  TerrainSurfaceSample,
} from "./terrain-types";
import type { TerrainPropLod } from "./terrain-prop-catalog";
import type { TerrainQualityTier } from "./terrain-quality";
import type { TerrainFogFieldStats } from "./terrain-fog-field";
import type { TerrainMovementInteraction } from "./terrain-movement-effects";

interface WorldmapProceduralCell {
  biomeKey: string;
  col: number;
  occupied: boolean;
  row: number;
}

export interface WorldmapProceduralPresentationInput {
  cells: readonly WorldmapProceduralCell[];
  climate?: BiomeClimateConfig;
  mapCenter: number;
  pageHeight: number;
  pageOrigin: { col: number; row: number };
  pageWidth: number;
  propDensityMultiplier?: number;
  roadAnchors?: readonly TerrainRoadAnchor[];
  settlementAnchors?: readonly TerrainSettlementAnchor[];
  subdivisions?: number;
}

export interface WorldmapProceduralPresentationDiagnostics extends TerrainPresentationDiagnostics {
  biomeMismatchCount: number;
  builtPages: number;
  commitMs: number;
  preparedCachePages: number;
  prepareMs: number;
  reusedPages: number;
}

interface TerrainPagePreparation {
  request: TerrainPageRequest;
  signature: string;
}

const BIOME_VALUES = new Set<string>(Object.values(BiomeType));

export class WorldmapProceduralTerrain {
  readonly object3d: Group;
  private readonly terrain = new ProceduralTerrain();
  private readonly preparedBySignature = new Map<string, PreparedTerrainPage>();
  private readonly pendingBySignature = new Map<string, Promise<PreparedTerrainPage>>();
  private currentRequestSignatures = new Set<string>();
  private previousRequestSignatures = new Set<string>();
  private presentationRevision = 0;
  private visibleCellCount = 0;

  constructor() {
    this.object3d = this.terrain.object3d;
    this.object3d.name = "worldmap-procedural-terrain";
  }

  present(input: WorldmapProceduralPresentationInput): WorldmapProceduralPresentationDiagnostics {
    this.presentationRevision += 1;
    const preparations = this.beginRequest(buildWorldmapTerrainPageRequests(input));
    const preparedPages: PreparedTerrainPage[] = [];
    let builtPages = 0;
    let reusedPages = 0;

    for (const preparation of preparations) {
      const cached = this.preparedBySignature.get(preparation.signature);
      const prepared = cached ?? this.preparePage(preparation);
      if (cached) reusedPages += 1;
      else builtPages += 1;
      preparedPages.push(prepared);
    }

    return this.commitPreparedPages(input, preparedPages, builtPages, reusedPages);
  }

  async presentAsync(
    input: WorldmapProceduralPresentationInput,
  ): Promise<WorldmapProceduralPresentationDiagnostics | null> {
    const revision = this.presentationRevision + 1;
    this.presentationRevision = revision;
    const preparations = this.beginRequest(buildWorldmapTerrainPageRequests(input));
    let builtPages = 0;
    let reusedPages = 0;
    const preparedPages = await Promise.all(
      preparations.map((preparation) => {
        const cached = this.preparedBySignature.get(preparation.signature);
        if (cached) {
          reusedPages += 1;
          return cached;
        }
        const pending = this.pendingBySignature.get(preparation.signature);
        if (pending) {
          reusedPages += 1;
          return pending;
        }
        builtPages += 1;
        return this.preparePageAsync(preparation);
      }),
    );
    if (revision !== this.presentationRevision) return null;
    const fogMask = await this.terrain.prepareFogMaskAsync(preparedPages);
    if (revision !== this.presentationRevision) return null;
    return this.commitPreparedPages(input, preparedPages, builtPages, reusedPages, fogMask);
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

  queueShroudReveal(col: number, row: number): void {
    this.terrain.queueShroudReveal(col, row);
  }

  update(deltaSeconds: number): void {
    this.terrain.update(deltaSeconds);
  }

  getShroudStats(): TerrainFogFieldStats {
    return this.terrain.getShroudStats();
  }

  setMovementInteractions(interactions: readonly TerrainMovementInteraction[]): void {
    this.terrain.setMovementInteractions(interactions);
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
    this.clearPreparedWork();
    this.visibleCellCount = 0;
  }

  dispose(): void {
    this.presentationRevision += 1;
    this.clearPreparedWork();
    this.visibleCellCount = 0;
    this.terrain.dispose();
  }

  private commitPreparedPages(
    input: WorldmapProceduralPresentationInput,
    preparedPages: PreparedTerrainPage[],
    builtPages: number,
    reusedPages: number,
    preparedFogMask?: TerrainFogMask | null,
  ): WorldmapProceduralPresentationDiagnostics {
    const commitStartedAt = performance.now();
    const presentation = this.terrain.present(preparedPages, preparedFogMask);
    const commitMs = performance.now() - commitStartedAt;
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
    return {
      ...presentation,
      ...diagnostics,
      builtPages,
      commitMs,
      preparedCachePages: this.preparedBySignature.size,
      reusedPages,
    };
  }

  private beginRequest(requests: readonly TerrainPageRequest[]): TerrainPagePreparation[] {
    const preparations = requests.map((request) => ({ request, signature: createRequestSignature(request) }));
    this.previousRequestSignatures = this.currentRequestSignatures;
    this.currentRequestSignatures = new Set(preparations.map(({ signature }) => signature));
    this.prunePreparedCache();
    return preparations;
  }

  private preparePage(preparation: TerrainPagePreparation): PreparedTerrainPage {
    const prepared = this.terrain.preparePage(preparation.request);
    this.retainPreparedPage(preparation.signature, prepared);
    return prepared;
  }

  private preparePageAsync(preparation: TerrainPagePreparation): Promise<PreparedTerrainPage> {
    const pending = this.terrain
      .preparePageAsync(preparation.request)
      .then((prepared) => {
        this.retainPreparedPage(preparation.signature, prepared);
        return prepared;
      })
      .finally(() => {
        if (this.pendingBySignature.get(preparation.signature) === pending) {
          this.pendingBySignature.delete(preparation.signature);
        }
      });
    this.pendingBySignature.set(preparation.signature, pending);
    return pending;
  }

  private retainPreparedPage(signature: string, prepared: PreparedTerrainPage): void {
    if (this.isRetainedRequest(signature)) this.preparedBySignature.set(signature, prepared);
  }

  private prunePreparedCache(): void {
    for (const signature of this.preparedBySignature.keys()) {
      if (!this.isRetainedRequest(signature)) this.preparedBySignature.delete(signature);
    }
  }

  private isRetainedRequest(signature: string): boolean {
    return this.currentRequestSignatures.has(signature) || this.previousRequestSignatures.has(signature);
  }

  private clearPreparedWork(): void {
    this.preparedBySignature.clear();
    this.pendingBySignature.clear();
    this.currentRequestSignatures.clear();
    this.previousRequestSignatures.clear();
  }
}

export function buildWorldmapTerrainPageRequests(input: WorldmapProceduralPresentationInput): TerrainPageRequest[] {
  requirePageSize(input.pageWidth, "width");
  requirePageSize(input.pageHeight, "height");
  requirePageOrigin(input.pageOrigin);
  const climate = input.climate ?? NEUTRAL_BIOME_CLIMATE;
  const cells = canonicalTerrainCells(input.cells.map(toTerrainCell));
  const cellsByKey = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
  const cellsByPage = new Map<string, TerrainCellInput[]>();
  const roadSegments = buildTerrainRoadSegments({ anchors: input.roadAnchors ?? [], cells });

  for (const cell of cells) {
    const pageKey = resolvePageKey(cell.col, cell.row, input.pageWidth, input.pageHeight, input.pageOrigin);
    const pageCells = cellsByPage.get(pageKey) ?? [];
    pageCells.push(cell);
    cellsByPage.set(pageKey, pageCells);
  }

  return Array.from(cellsByPage.entries())
    .toSorted(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))
    .map(([pageKey, pageCells]) => {
      const canonicalCells = canonicalTerrainCells(pageCells);
      const halo = resolvePageHalo(pageCells, cellsByKey);
      return {
        cells: canonicalCells,
        climate,
        halo,
        mapCenter: input.mapCenter,
        pageKey,
        propDensityMultiplier: input.propDensityMultiplier,
        roadSegments: resolvePageRoadSegments(pageCells, roadSegments),
        settlementAnchors: resolvePageSettlementAnchors(canonicalCells, input.settlementAnchors ?? []),
        strictBiomeParity: false,
        subdivisions: input.subdivisions ?? 2,
      };
    });
}

function resolvePageSettlementAnchors(
  pageCells: readonly TerrainCellInput[],
  anchors: readonly TerrainSettlementAnchor[],
): TerrainSettlementAnchor[] {
  const centers = pageCells.map(({ col, row }) => terrainHexToWorld(col, row));
  const minimumX = Math.min(...centers.map(({ x }) => x)) - MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS;
  const maximumX = Math.max(...centers.map(({ x }) => x)) + MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS;
  const minimumZ = Math.min(...centers.map(({ z }) => z)) - MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS;
  const maximumZ = Math.max(...centers.map(({ z }) => z)) + MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS;
  return anchors
    .filter(({ col, row }) => {
      const center = terrainHexToWorld(col, row);
      return center.x >= minimumX && center.x <= maximumX && center.z >= minimumZ && center.z <= maximumZ;
    })
    .toSorted((left, right) => left.structureId.localeCompare(right.structureId));
}

function resolvePageRoadSegments(
  pageCells: readonly TerrainCellInput[],
  roadSegments: readonly TerrainRoadSegment[],
): TerrainRoadSegment[] {
  const centers = pageCells.map(({ col, row }) => terrainHexToWorld(col, row));
  const padding = 1.5;
  const minimumX = Math.min(...centers.map(({ x }) => x)) - padding;
  const maximumX = Math.max(...centers.map(({ x }) => x)) + padding;
  const minimumZ = Math.min(...centers.map(({ z }) => z)) - padding;
  const maximumZ = Math.max(...centers.map(({ z }) => z)) + padding;
  return roadSegments.filter(
    ({ start, end }) =>
      Math.max(start[0], end[0]) >= minimumX &&
      Math.min(start[0], end[0]) <= maximumX &&
      Math.max(start[1], end[1]) >= minimumZ &&
      Math.min(start[1], end[1]) <= maximumZ,
  );
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
  const biome = resolveBiomeKey(cell.biomeKey);
  return {
    biome,
    col: cell.col,
    explored: biome !== null,
    occupied: cell.occupied,
    previewBiome: biome,
    row: cell.row,
  };
}

function resolveBiomeKey(biomeKey: string): BiomeType | null {
  if (biomeKey === "Outline" || biomeKey === "Empty") return null;
  const normalized = biomeKey.endsWith("Alt") ? biomeKey.slice(0, -3) : biomeKey;
  return BIOME_VALUES.has(normalized) && normalized !== BiomeType.None ? (normalized as BiomeType) : null;
}

function resolvePageKey(
  col: number,
  row: number,
  pageWidth: number,
  pageHeight: number,
  pageOrigin: WorldmapProceduralPresentationInput["pageOrigin"],
): string {
  const startCol = Math.floor((col - pageOrigin.col) / pageWidth) * pageWidth + pageOrigin.col;
  const startRow = Math.floor((row - pageOrigin.row) / pageHeight) * pageHeight + pageOrigin.row;
  return `${startRow},${startCol}`;
}

function canonicalTerrainCells(cells: readonly TerrainCellInput[]): TerrainCellInput[] {
  return cells.toSorted((left, right) => left.row - right.row || left.col - right.col);
}

function createRequestSignature(request: TerrainPageRequest): string {
  return JSON.stringify({
    cells: request.cells,
    climate: request.climate,
    // A newly landed neighbour legitimately rebuilds the pages whose edge blending halo changed.
    halo: request.halo,
    mapCenter: request.mapCenter,
    pageKey: request.pageKey,
    propDensityMultiplier: request.propDensityMultiplier,
    roadSegments: request.roadSegments,
    settlementAnchors: request.settlementAnchors,
    subdivisions: request.subdivisions,
  });
}

function requirePageOrigin(origin: WorldmapProceduralPresentationInput["pageOrigin"]): void {
  if (!Number.isInteger(origin.col) || !Number.isInteger(origin.row)) {
    throw new Error("Worldmap procedural terrain page origin must use integer coordinates");
  }
}

function requirePageSize(value: number, axis: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Worldmap procedural terrain page ${axis} must be a positive integer`);
  }
}
