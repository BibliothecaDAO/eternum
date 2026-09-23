import { useCallback } from "react";

import { Position } from "@bibliothecadao/eternum";

import { buildPlayHref, parsePlayRoute, type PlayScene } from "@/play/navigation/play-route";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@/hooks/helpers/use-query";
import { ID } from "@bibliothecadao/types";
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

const resolvePlaySceneHref = (scene: PlayScene, position: Position): string => {
  const playRoute = parsePlayRoute(window.location);
  if (!playRoute) throw new Error(`Cannot navigate scenes outside a game route: ${window.location.pathname}`);
  const normalized = position.getNormalized();
  return buildPlayHref({ ...playRoute, scene, col: normalized.x, row: normalized.y });
};

const useNavigateToHexView = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const { handleUrlChange } = useQuery();

  return (position: Position) => {
    const url = resolvePlaySceneHref("hex", position);

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
    const url = resolvePlaySceneHref("map", position);

    if (!isMapView) {
      setIsLoadingScreenEnabled(true);
    }
    showBlankOverlay(false);
    setPreviewBuilding(null);
    handleUrlChange(url);
  };
};

export const useGoToStructure = (setupResult: GameClientSetup | null) => {
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const navigateToHexView = useNavigateToHexView();
  const navigateToMapView = useNavigateToMapView();

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
