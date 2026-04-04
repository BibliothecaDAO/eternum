import { sqlApi } from "@/services/api";
import { useEffect, useSyncExternalStore } from "react";

import { MinimapTile, normalizeMinimapTile } from "./strategic-map-coordinates";

interface StrategicMapTilesSnapshot {
  tiles: MinimapTile[];
  isLoading: boolean;
  error: string | null;
}

const listeners = new Set<() => void>();
let snapshot: StrategicMapTilesSnapshot = {
  tiles: [],
  isLoading: false,
  error: null,
};
let inFlightRequest: Promise<void> | null = null;

export function useStrategicMapTiles(enabled: boolean, refreshMs: number = 60_000) {
  const storeSnapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void loadStrategicMapTiles();
    const intervalId = window.setInterval(() => {
      void loadStrategicMapTiles(true);
    }, refreshMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, refreshMs]);

  return {
    ...storeSnapshot,
    reload: () => loadStrategicMapTiles(true),
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StrategicMapTilesSnapshot {
  return snapshot;
}

async function loadStrategicMapTiles(forceRefresh: boolean = false): Promise<void> {
  if (!forceRefresh && inFlightRequest) {
    return inFlightRequest;
  }

  if (!snapshot.isLoading) {
    snapshot = {
      ...snapshot,
      isLoading: true,
      error: forceRefresh ? snapshot.error : null,
    };
    emitChange();
  }

  inFlightRequest = (async () => {
    try {
      const fetchedTiles = await sqlApi.fetchAllTiles();
      snapshot = {
        tiles: fetchedTiles.map((tile) =>
          normalizeMinimapTile({
            col: tile.col,
            row: tile.row,
            biome: tile.biome,
            occupier_id: tile.occupier_id?.toString(),
            occupier_type: tile.occupier_type,
            occupier_is_structure: tile.occupier_is_structure,
          }),
        ),
        isLoading: false,
        error: null,
      };
    } catch (error) {
      snapshot = {
        ...snapshot,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load strategic map data",
      };
    } finally {
      inFlightRequest = null;
      emitChange();
    }
  })();

  return inFlightRequest;
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}
