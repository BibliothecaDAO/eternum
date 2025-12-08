import { useCallback } from "react";

import { Position } from "@bibliothecadao/eternum";

import { getStructuresDataFromTorii } from "@/dojo/queries";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { SetupResult } from "@bibliothecadao/dojo";
import { useQuery } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useUIStore } from "../store/use-ui-store";

type PositionLike = Position | { x?: number; y?: number; col?: number; row?: number };

const isPositionInstance = (value: PositionLike | undefined): value is Position => {
  const candidate = value as unknown as { toMapLocationUrl?: () => string };
  return value instanceof Position || typeof candidate?.toMapLocationUrl === "function";
};

const normalizeToPosition = (value?: PositionLike): Position => {
  if (isPositionInstance(value)) {
    return value;
  }

  const candidate = value ?? {};
  const x = Number(candidate.x ?? candidate.col ?? 0);
  const y = Number(candidate.y ?? candidate.row ?? 0);

  return new Position({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  });
};

const toWorldMapPosition = (position: PositionLike): { col: number; row: number } | undefined => {
  const positionAny = position as unknown as {
    getContract?: () => { col?: number; row?: number; x?: number; y?: number };
    getNormalized?: () => { x?: number; y?: number };
    col?: number;
    row?: number;
    x?: number;
    y?: number;
  };

  if (typeof positionAny.getContract === "function") {
    const contractPosition = positionAny.getContract();
    const col = Number(contractPosition?.col ?? contractPosition?.x);
    const row = Number(contractPosition?.row ?? contractPosition?.y);

    if (Number.isFinite(col) && Number.isFinite(row)) {
      return { col, row };
    }
  }

  if (typeof positionAny.getNormalized === "function") {
    const normalized = positionAny.getNormalized();
    const col = Number(normalized?.x);
    const row = Number(normalized?.y);

    if (Number.isFinite(col) && Number.isFinite(row)) {
      return { col, row };
    }
  }

  const col = Number(positionAny?.col ?? positionAny?.x);
  const row = Number(positionAny?.row ?? positionAny?.y);

  if (Number.isFinite(col) && Number.isFinite(row)) {
    return { col, row };
  }

  return undefined;
};

const useNavigateToHexView = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const { handleUrlChange } = useQuery();

  return (position: Position) => {
    const url = position.toHexLocationUrl();

    setIsLoadingScreenEnabled(true);
    showBlankOverlay(false);
    setPreviewBuilding(null);
    handleUrlChange(url);
  };
};

export const useNavigateToMapView = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const { handleUrlChange, isMapView } = useQuery();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  return (position: Position) => {
    if (!isMapView) {
      setIsLoadingScreenEnabled(true);
    }
    showBlankOverlay(false);
    setPreviewBuilding(null);
    handleUrlChange(position.toMapLocationUrl());
  };
};

export const useSpectatorModeClick = (setupResult: SetupResult | null) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const worldMapReturnPosition = useUIStore((state) => state.worldMapReturnPosition);
  const goToStructure = useGoToStructure(setupResult);

  return useCallback(() => {
    if (!setupResult) {
      return;
    }

    if (!structureEntityId || structureEntityId === UNDEFINED_STRUCTURE_ENTITY_ID) {
      return;
    }

    let structure: any = null;

    try {
      structure =
        setupResult.components.Structure &&
        getComponentValue(setupResult.components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]));
    } catch (error) {
      console.warn("[useSpectatorModeClick] Unable to resolve structure", structureEntityId, error);
    }

    if (structure) {
      goToStructure(structure.entity_id, new Position({ x: structure.base.coord_x, y: structure.base.coord_y }), true, {
        spectator: true,
      });
      return;
    }

    if (worldMapReturnPosition) {
      const { col, row } = worldMapReturnPosition;
      goToStructure(structureEntityId, new Position({ x: col, y: row }), true, {
        spectator: true,
      });
    }
  }, [goToStructure, setupResult, structureEntityId, worldMapReturnPosition]);
};

export const useGoToStructure = (setupResult: SetupResult | null) => {
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const navigateToHexView = useNavigateToHexView();
  const navigateToMapView = useNavigateToMapView();

  const ensureStructureSynced = useCallback(
    async (structureEntityId: ID, position: Position, worldMapPosition?: { col: number; row: number }) => {
      const components = setupResult?.components;
      const toriiClient = setupResult?.network?.toriiClient;
      const contractComponents = setupResult?.network?.contractComponents;

      if (!components?.Structure || !toriiClient || !contractComponents) {
        return;
      }

      let entityKey: any;
      try {
        entityKey = getEntityIdFromKeys([BigInt(structureEntityId)]);
      } catch (error) {
        console.warn("[useGoToStructure] Unable to build entity key for", structureEntityId, error);
        return;
      }

      const existing = getComponentValue(components.Structure, entityKey);
      if (existing) {
        return;
      }

      const effectivePosition = worldMapPosition ?? toWorldMapPosition(position);

      if (!effectivePosition) {
        console.warn("[useGoToStructure] Unable to determine structure coordinates for", structureEntityId);
        return;
      }

      const { col, row } = effectivePosition;

      const numericId = Number(structureEntityId);
      if (!Number.isFinite(numericId)) {
        console.warn("[useGoToStructure] Structure id is not a finite number", structureEntityId);
        return;
      }

      const previousCursor = document.body.style.cursor;
      document.body.style.cursor = "wait";

      try {
        await getStructuresDataFromTorii(toriiClient, contractComponents as any, [
          {
            entityId: numericId,
            position: { col, row },
          },
        ]);
      } catch (error) {
        console.error("[useGoToStructure] Failed to sync structure before navigation", error);
      } finally {
        document.body.style.cursor = previousCursor;
      }
    },
    [setupResult],
  );

  const updateSelectedHex = useCallback(
    (worldMapPosition?: { col: number; row: number }) => {
      if (!worldMapPosition) {
        return;
      }

      const col = Number(worldMapPosition.col);
      const row = Number(worldMapPosition.row);

      if (!Number.isFinite(col) || !Number.isFinite(row)) {
        return;
      }

      const nextSelection = { col, row };
      setSelectedHex(nextSelection);
      // World scene clears selection on URL changes; reapply next tick to keep the tile highlighted.
      setTimeout(() => setSelectedHex(nextSelection), 0);
    },
    [setSelectedHex],
  );

  return async (
    structureEntityId: ID,
    positionInput: PositionLike,
    isMapView: boolean,
    options?: { spectator?: boolean },
  ) => {
    const targetPosition = normalizeToPosition(positionInput);
    const worldMapPosition = toWorldMapPosition(targetPosition);

    try {
      await ensureStructureSynced(structureEntityId, targetPosition, worldMapPosition);
    } catch (error) {
      console.error("[useGoToStructure] Unexpected error while syncing structure", error);
    }

    setStructureEntityId(structureEntityId, {
      spectator: options?.spectator ?? false,
      worldMapPosition,
    });

    updateSelectedHex(worldMapPosition);

    if (isMapView) {
      navigateToMapView(targetPosition);
      return;
    }

    navigateToHexView(targetPosition);
  };
};
