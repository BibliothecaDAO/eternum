import type { WorldSpatialBounds, WorldSpatialHex, WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import type { StructureType } from "@bibliothecadao/types";
import type { Component } from "@dojoengine/recs";

import { hexCellKey } from "@/three/terrain/hex-cell-key";
import type { TerrainRoadAnchor, TerrainSettlementAnchor } from "@/three/terrain/terrain-types";

interface StructureTerrainEcologyFacts {
  readonly base: {
    readonly category: StructureType;
    readonly level: number;
  };
  readonly entity_id?: number;
  readonly owner: bigint;
}

interface CollectWorldmapTerrainEcologyAnchorsInput {
  cells: readonly { biomeKey: string; col: number; row: number }[];
  getStructureFacts: (entityId: number) => StructureTerrainEcologyFacts | undefined;
  normalizeStructureHex: (hex: WorldSpatialHex) => { col: number; row: number };
  projection: Pick<WorldSpatialProjection, "getStructuresInBounds">;
  toProjectionBounds: (bounds: WorldSpatialBounds) => WorldSpatialBounds;
}

interface BindWorldmapTerrainEcologyRefreshInput {
  onStructureComponentChanged?: (current: StructureTerrainEcologyFacts | undefined) => void;
  projection: Pick<WorldSpatialProjection, "subscribeStructures">;
  requestRefresh: () => void;
  structureComponent: Component;
}

export function bindWorldmapTerrainEcologyRefresh(input: BindWorldmapTerrainEcologyRefreshInput): () => void {
  const unsubscribeProjection = input.projection.subscribeStructures(() => {
    input.requestRefresh();
  });
  const structureSubscription = input.structureComponent.update$.subscribe(({ value }) => {
    const [current, previous] = value as [
      StructureTerrainEcologyFacts | undefined,
      StructureTerrainEcologyFacts | undefined,
    ];
    if (!didStructureTerrainEcologyChange(current, previous)) return;
    input.requestRefresh();
    input.onStructureComponentChanged?.(current);
  });

  return () => {
    unsubscribeProjection();
    structureSubscription.unsubscribe();
  };
}

export function collectWorldmapTerrainEcologyAnchors(input: CollectWorldmapTerrainEcologyAnchorsInput): {
  roadAnchors: TerrainRoadAnchor[];
  settlementAnchors: TerrainSettlementAnchor[];
} {
  const visibleCells = new Set<number>();
  const localBounds = createEmptyWorldSpatialBounds();
  for (const { biomeKey, col, row } of input.cells) {
    if (biomeKey === "Outline" || biomeKey === "Empty") continue;
    visibleCells.add(hexCellKey(col, row));
    localBounds.maxCol = Math.max(localBounds.maxCol, col);
    localBounds.maxRow = Math.max(localBounds.maxRow, row);
    localBounds.minCol = Math.min(localBounds.minCol, col);
    localBounds.minRow = Math.min(localBounds.minRow, row);
  }
  if (visibleCells.size === 0) return { roadAnchors: [], settlementAnchors: [] };

  const roadAnchors: TerrainRoadAnchor[] = [];
  const settlementAnchors: TerrainSettlementAnchor[] = [];
  for (const structure of input.projection.getStructuresInBounds(input.toProjectionBounds(localBounds))) {
    if (structure.reserved || structure.entityId === null) continue;
    const normalized = input.normalizeStructureHex(structure.hexCoords);
    if (!visibleCells.has(hexCellKey(normalized.col, normalized.row))) continue;
    const facts = input.getStructureFacts(structure.entityId);
    if (!facts) continue;
    const structureId = structure.entityId.toString();
    settlementAnchors.push({
      ...normalized,
      level: facts.base.level,
      structureId,
      structureType: facts.base.category,
    });
    if (facts.owner === 0n) continue;
    roadAnchors.push({
      ...normalized,
      owner: facts.owner.toString(),
      structureId,
    });
  }
  return { roadAnchors, settlementAnchors };
}

function didStructureTerrainEcologyChange(
  current: StructureTerrainEcologyFacts | undefined,
  previous: StructureTerrainEcologyFacts | undefined,
): boolean {
  return (
    current?.owner !== previous?.owner ||
    current?.base.category !== previous?.base.category ||
    current?.base.level !== previous?.base.level
  );
}

function createEmptyWorldSpatialBounds() {
  return {
    maxCol: Number.NEGATIVE_INFINITY,
    maxRow: Number.NEGATIVE_INFINITY,
    minCol: Number.POSITIVE_INFINITY,
    minRow: Number.POSITIVE_INFINITY,
  };
}
