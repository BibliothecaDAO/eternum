import type {
  TileSpatialProjectionChange,
  WorldSpatialHex,
  WorldSpatialProjection,
  WorldSpatialProjectionChange,
} from "@bibliothecadao/eternum/game-sync";

/** Pair discovery with movement from the same shared update, for players and spectators alike. */
export function subscribeWorldmapTileChanges(
  projection: Pick<WorldSpatialProjection, "subscribe">,
  onTileChange: (change: TileSpatialProjectionChange, source?: WorldSpatialHex) => void,
): () => void {
  return projection.subscribe((changes) => {
    if (!changes.some((change) => change.kind === "tile")) return;
    const movementSources = collectMovementSources(changes);
    for (const change of changes) {
      if (change.kind !== "tile") continue;
      const source =
        !change.previous && change.current ? movementSources.get(hexKey(change.current.hexCoords)) : undefined;
      onTileChange(change, source);
    }
  });
}

function collectMovementSources(
  changes: readonly WorldSpatialProjectionChange[],
): Map<string, WorldSpatialHex | undefined> {
  const sources = new Map<string, WorldSpatialHex | undefined>();
  for (const change of changes) {
    if (change.kind !== "army" || !change.previous || !change.current) continue;
    const source = change.previous.hexCoords;
    const destination = change.current.hexCoords;
    if (hexKey(source) === hexKey(destination)) continue;
    const key = hexKey(destination);
    // Multiple arrivals from different origins do not identify which army discovered the tile.
    if (sources.has(key) && hexKey(sources.get(key)) !== hexKey(source)) sources.set(key, undefined);
    else sources.set(key, source);
  }
  return sources;
}

function hexKey(hex?: WorldSpatialHex): string {
  return hex ? `${hex.col},${hex.row}` : "";
}
