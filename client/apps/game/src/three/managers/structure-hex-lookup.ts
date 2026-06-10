interface HexLike {
  col: number;
  row: number;
}

/**
 * Phase 3.4: resolve the structure sitting exactly on `hexCoords` from a spatial
 * bucket's candidate ids, instead of scanning every structure on the map.
 *
 * The spatial bucket (chunkToStructures) groups structures by a coarse chunk key,
 * so a bucket can contain several structures on different hexes — the exact-hex
 * match is still required. Candidate ids whose record is missing (a stale index
 * entry) are skipped.
 */
export function findStructureAtHex<TId, TStructure extends { hexCoords: HexLike }>(
  hexCoords: HexLike,
  candidateIds: Iterable<TId> | undefined,
  getStructureByEntityId: (id: TId) => TStructure | undefined,
): TStructure | undefined {
  if (!candidateIds) {
    return undefined;
  }

  for (const id of candidateIds) {
    const structure = getStructureByEntityId(id);
    if (structure && structure.hexCoords.col === hexCoords.col && structure.hexCoords.row === hexCoords.row) {
      return structure;
    }
  }

  return undefined;
}
