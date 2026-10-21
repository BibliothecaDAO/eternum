import { getActiveGameSyncRuntime, type WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { useEffect, useMemo, useState } from "react";

/** What moves on the map's projection: each layer tells its own listeners. */
type SpatialLayer = "armies" | "chests" | "tiles";

/**
 * The world's spatial projection as of its last move on `layers`: a new value each time one moves, so a memo that reads
 * `spatial.projection` lists `spatial` and reads again. `layers` is a module constant, read once per projection.
 */
type SpatialView = { readonly projection: WorldSpatialProjection | null; readonly revision: number };

export const useSpatialProjection = (layers: readonly SpatialLayer[]): SpatialView => {
  const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection() ?? null;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!projection) return;
    const bump = () => setRevision((current) => current + 1);
    const stops = layers.map((layer) => subscribeLayer(projection, layer, bump));
    return () => stops.forEach((stop) => stop());
  }, [projection, layers]);
  return useMemo(() => ({ projection, revision }), [projection, revision]);
};

const subscribeLayer = (projection: WorldSpatialProjection, layer: SpatialLayer, moved: () => void) => {
  if (layer === "armies") return projection.subscribeArmies(moved);
  if (layer === "chests") return projection.subscribeChests(moved);
  return projection.subscribeTiles(moved);
};
