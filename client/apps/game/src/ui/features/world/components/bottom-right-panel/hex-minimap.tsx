import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { FELT_CENTER } from "@/ui/config";
import { BIOME_COLORS } from "@/three/managers/biome-colors";
import {
  getExplorerInfoFromTileOccupier,
  getStructureInfoFromTileOccupier,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { BiomeIdToType, BiomeType, HexPosition, StructureType, TileOccupier } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";

export interface MinimapTile {
  col: number;
  row: number;
  biome?: number;
  occupier_id?: string;
  occupier_type?: number;
  occupier_is_structure?: boolean;
}

export const normalizeMinimapTile = (tile: MinimapTile): MinimapTile => ({
  col: Number(tile.col),
  row: Number(tile.row),
  biome: tile.biome !== undefined ? Number(tile.biome) : undefined,
  occupier_id: normalizeEntityId(tile.occupier_id) ?? undefined,
  occupier_type: tile.occupier_type !== undefined ? Number(tile.occupier_type) : undefined,
  occupier_is_structure: Boolean(tile.occupier_is_structure),
});

const normalizeEntityId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (!raw) return null;
  try {
    const parsed = BigInt(raw);
    if (parsed === 0n) return null;
    return parsed.toString();
  } catch {
    return raw === "0" ? null : raw;
  }
};

const HEX_SIZE = 7;
const SQRT3 = Math.sqrt(3);
const CAMERA_CIRCLE_SCREEN_RADIUS_PX = 60;
const WORLD_CAMERA_DISTANCE_REFERENCE = 20;
const MINIMAP_SCALE_REFERENCE = 1.4;

type TileMarker = {
  iconSrc: string;
  sizeMultiplier?: number;
};

const LABEL_ICONS = {
  armyMine: "/images/labels/army.png",
  armyEnemy: "/images/labels/enemy_army.png",
  realmMine: "/images/labels/realm.png",
  realmEnemy: "/images/labels/enemy_realm.png",
  villageMine: "/images/labels/village.png",
  villageEnemy: "/images/labels/enemy_village.png",
  hyperstructure: "/images/labels/hyperstructure.png",
  fragmentMine: "/images/labels/fragment_mine.png",
  quest: "/images/labels/quest.png",
  chest: "/images/labels/chest.png",
} as const;

const getGridMetrics = () => {
  const hexHeight = HEX_SIZE * 2;
  const hexWidth = SQRT3 * HEX_SIZE;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;
  return { vertDist, horizDist };
};

const offsetToPixel = (col: number, row: number) => {
  const { vertDist, horizDist } = getGridMetrics();
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const x = col * horizDist - rowOffset;
  const y = row * vertDist;
  return { x, y };
};

const pixelToOffset = (x: number, y: number) => {
  const { vertDist, horizDist } = getGridMetrics();
  const row = Math.round(y / vertDist);
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const col = Math.round((x + rowOffset) / horizDist);
  return { col, row };
};

const hexCorners = (center: { x: number; y: number }) => {
  const corners: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({
      x: center.x + HEX_SIZE * Math.cos(angle),
      y: center.y + HEX_SIZE * Math.sin(angle),
    });
  }
  return corners;
};

const getBiomeColor = (biomeId?: number) => {
  if (biomeId === undefined) return "#4b5563";
  const biomeType = BiomeIdToType[biomeId];
  if (biomeType === BiomeType.Taiga) return "#ffffff";
  const color = BIOME_COLORS[biomeType as keyof typeof BIOME_COLORS];
  return color?.getStyle?.() ?? "#4b5563";
};

const getOccupierColor = (tile: MinimapTile) => {
  if (!tile.occupier_id) return null;
  const type = tile.occupier_type ?? 0;
  const isStructure = tile.occupier_is_structure || isTileOccupierStructure(type);
  return isStructure ? "#22d3ee" : "#f97316";
};

type CenteredTileEntry = {
  tile: MinimapTile;
  centeredCol: number;
  centeredRow: number;
  pixel: { x: number; y: number };
  points: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

type CenteredIndex = {
  byCol: Map<number, CenteredTileEntry[]>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

const buildCenteredIndex = (tiles: MinimapTile[]): CenteredIndex => {
  const center = FELT_CENTER();
  const byCol = new Map<number, CenteredTileEntry[]>();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const tile of tiles) {
    const centeredCol = tile.col - center;
    const centeredRow = tile.row - center;
    const pixel = offsetToPixel(centeredCol, centeredRow);
    const corners = hexCorners(pixel);
    const points = corners.map((corner) => `${corner.x},${corner.y}`).join(" ");
    const tileMinX = Math.min(...corners.map((c) => c.x));
    const tileMaxX = Math.max(...corners.map((c) => c.x));
    const tileMinY = Math.min(...corners.map((c) => c.y));
    const tileMaxY = Math.max(...corners.map((c) => c.y));

    minX = Math.min(minX, tileMinX);
    maxX = Math.max(maxX, tileMaxX);
    minY = Math.min(minY, tileMinY);
    maxY = Math.max(maxY, tileMaxY);

    const entry: CenteredTileEntry = {
      tile,
      centeredCol,
      centeredRow,
      pixel,
      points,
      bounds: { minX: tileMinX, maxX: tileMaxX, minY: tileMinY, maxY: tileMaxY },
    };

    const list = byCol.get(centeredCol);
    if (list) {
      list.push(entry);
    } else {
      byCol.set(centeredCol, [entry]);
    }
  }

  byCol.forEach((entries) => entries.sort((a, b) => a.centeredRow - b.centeredRow));

  return {
    byCol,
    bounds: {
      minX: Number.isFinite(minX) ? minX : 0,
      maxX: Number.isFinite(maxX) ? maxX : 0,
      minY: Number.isFinite(minY) ? minY : 0,
      maxY: Number.isFinite(maxY) ? maxY : 0,
    },
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface HexMinimapProps {
  tiles: MinimapTile[];
  selectedHex: HexPosition | null;
  navigationTarget: HexPosition | null;
  cameraTargetHex: HexPosition | null;
}

export const HexMinimap = ({ tiles, selectedHex, navigationTarget, cameraTargetHex }: HexMinimapProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const playerStructures = useUIStore((state) => state.playerStructures);
  const selectableArmies = useUIStore((state) => state.selectableArmies);
  const cameraDistance = useUIStore((state) => state.cameraDistance);
  const currentPlayerData = usePlayerStore((state) => state.currentPlayerData);
  const mode = useGameModeConfig();

  const ownedStructureIds = useMemo(() => {
    return new Set(
      playerStructures
        .map((structure) => normalizeEntityId(structure.entityId))
        .filter((id): id is string => Boolean(id)),
    );
  }, [playerStructures]);

  const ownedExplorerIds = useMemo(() => {
    const ids = new Set<string>();

    selectableArmies.forEach((army) => {
      const id = normalizeEntityId(army.entityId);
      if (id) ids.add(id);
    });

    currentPlayerData?.explorerIds?.forEach((entry) => {
      const id = normalizeEntityId(entry.split(":")[0]);
      if (id) ids.add(id);
    });

    return ids;
  }, [selectableArmies, currentPlayerData]);

  const centeredIndex = useMemo(() => buildCenteredIndex(tiles), [tiles]);

  const initialView = useMemo(() => {
    if (!tiles.length) {
      return { x: 0, y: 0, scale: MINIMAP_SCALE_REFERENCE };
    }

    const targetHex = cameraTargetHex ?? navigationTarget ?? selectedHex;
    if (targetHex) {
      const col = targetHex.col - FELT_CENTER();
      const row = targetHex.row - FELT_CENTER();
      const centerPixel = offsetToPixel(col, row);
      return { x: centerPixel.x, y: centerPixel.y, scale: MINIMAP_SCALE_REFERENCE };
    }

    return {
      x: (centeredIndex.bounds.minX + centeredIndex.bounds.maxX) / 2,
      y: (centeredIndex.bounds.minY + centeredIndex.bounds.maxY) / 2,
      scale: MINIMAP_SCALE_REFERENCE,
    };
  }, [tiles.length, cameraTargetHex, navigationTarget, selectedHex, centeredIndex.bounds]);

  const [view, setView] = useState<{ x: number; y: number; scale: number }>(initialView);
  const viewRef = useRef(view);
  viewRef.current = view;
  const isDraggingRef = useRef(false);

  const followTargetRef = useRef<{ x: number; y: number } | null>(null);
  const followRafRef = useRef<number | null>(null);

  const startFollowAnimation = useCallback(() => {
    if (followRafRef.current !== null) return;

    const tick = () => {
      followRafRef.current = null;
      const target = followTargetRef.current;
      if (!target || isDraggingRef.current) return;

      const current = viewRef.current;
      const lerp = 0.18;

      const nextX = current.x + (target.x - current.x) * lerp;
      const nextY = current.y + (target.y - current.y) * lerp;
      const done = Math.hypot(target.x - nextX, target.y - nextY) < 0.5;

      const updated = done
        ? { x: target.x, y: target.y, scale: current.scale }
        : { x: nextX, y: nextY, scale: current.scale };

      setView(updated);
      viewRef.current = updated;

      if (done) {
        followTargetRef.current = null;
        return;
      }

      followRafRef.current = requestAnimationFrame(tick);
    };

    followRafRef.current = requestAnimationFrame(tick);
  }, []);

  const rafRef = useRef<number | null>(null);
  const pendingViewRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  const scheduleViewUpdate = useCallback((next: { x: number; y: number; scale: number }) => {
    pendingViewRef.current = next;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingViewRef.current) {
        setView(pendingViewRef.current);
        pendingViewRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!cameraDistance) return;
    const nextScale = clamp((MINIMAP_SCALE_REFERENCE * WORLD_CAMERA_DISTANCE_REFERENCE) / cameraDistance, 0.4, 4);
    const current = viewRef.current;
    if (Math.abs(current.scale - nextScale) < 0.01) return;
    scheduleViewUpdate({ ...current, scale: nextScale });
  }, [cameraDistance, scheduleViewUpdate]);

  const dispatchCameraMove = useCallback((centerX: number, centerY: number) => {
    if (typeof window === "undefined") return;
    const { col, row } = pixelToOffset(centerX, centerY);
    window.dispatchEvent(new CustomEvent("minimapCameraMove", { detail: { col, row } }));
  }, []);

  const cameraMoveRafRef = useRef<number | null>(null);
  const pendingCameraMoveRef = useRef<{ x: number; y: number } | null>(null);
  const scheduleCameraMove = useCallback(
    (centerX: number, centerY: number) => {
      pendingCameraMoveRef.current = { x: centerX, y: centerY };
      if (cameraMoveRafRef.current !== null) return;
      cameraMoveRafRef.current = requestAnimationFrame(() => {
        cameraMoveRafRef.current = null;
        const pending = pendingCameraMoveRef.current;
        if (!pending) return;
        pendingCameraMoveRef.current = null;
        dispatchCameraMove(pending.x, pending.y);
      });
    },
    [dispatchCameraMove],
  );

  useEffect(() => {
    if (!cameraTargetHex || isDraggingRef.current) return;
    const col = cameraTargetHex.col - FELT_CENTER();
    const row = cameraTargetHex.row - FELT_CENTER();
    const centerPixel = offsetToPixel(col, row);
    followTargetRef.current = centerPixel;
    startFollowAnimation();
  }, [cameraTargetHex, startFollowAnimation]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height) {
        setViewport({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const viewBox = useMemo(() => {
    const width = viewport.width / view.scale;
    const height = viewport.height / view.scale;
    return {
      minX: view.x - width / 2,
      minY: view.y - height / 2,
      width,
      height,
      value: `${view.x - width / 2} ${view.y - height / 2} ${width} ${height}`,
    };
  }, [viewport, view]);

  const cameraCircle = useMemo(() => {
    if (!cameraTargetHex) return null;
    const col = cameraTargetHex.col - FELT_CENTER();
    const row = cameraTargetHex.row - FELT_CENTER();
    const centerPixel = offsetToPixel(col, row);
    const radiusPx = CAMERA_CIRCLE_SCREEN_RADIUS_PX / view.scale;
    return { centerPixel, radiusPx };
  }, [cameraTargetHex, view.scale]);

  const visibleTiles = useMemo(() => {
    if (!tiles.length) return [] as CenteredTileEntry[];

    const { vertDist, horizDist } = getGridMetrics();
    const paddingPx = HEX_SIZE * 3;
    const minX = viewBox.minX - paddingPx;
    const maxX = viewBox.minX + viewBox.width + paddingPx;
    const minY = viewBox.minY - paddingPx;
    const maxY = viewBox.minY + viewBox.height + paddingPx;

    const minRow = Math.floor(minY / vertDist) - 2;
    const maxRow = Math.ceil(maxY / vertDist) + 2;

    const rowOffsetMin = 0;
    const rowOffsetMax = horizDist / 2;
    const colCandidates = [
      (minX + rowOffsetMin) / horizDist,
      (minX + rowOffsetMax) / horizDist,
      (maxX + rowOffsetMin) / horizDist,
      (maxX + rowOffsetMax) / horizDist,
    ];
    const minCol = Math.floor(Math.min(...colCandidates)) - 2;
    const maxCol = Math.ceil(Math.max(...colCandidates)) + 2;

    const result: CenteredTileEntry[] = [];
    for (let col = minCol; col <= maxCol; col += 1) {
      const entries = centeredIndex.byCol.get(col);
      if (!entries) continue;
      for (const entry of entries) {
        if (entry.centeredRow < minRow || entry.centeredRow > maxRow) continue;
        if (
          entry.bounds.maxX < minX ||
          entry.bounds.minX > maxX ||
          entry.bounds.maxY < minY ||
          entry.bounds.minY > maxY
        ) {
          continue;
        }
        result.push(entry);
      }
    }

    return result;
  }, [tiles.length, centeredIndex.byCol, viewBox]);

  const getTileMarker = useCallback(
    (tile: MinimapTile) => {
      const occupierType = tile.occupier_type ?? 0;
      if (occupierType === TileOccupier.Chest) {
        return { iconSrc: LABEL_ICONS.chest } satisfies TileMarker;
      }

      if (occupierType === TileOccupier.Quest) {
        return { iconSrc: LABEL_ICONS.quest } satisfies TileMarker;
      }

      const hasStructure = tile.occupier_is_structure || isTileOccupierStructure(occupierType);

      if (hasStructure) {
        const info = getStructureInfoFromTileOccupier(occupierType);
        if (!info) return null;

        switch (info.type) {
          case StructureType.FragmentMine:
            return {
              iconSrc: mode.assets.labels.fragmentMine,
            } satisfies TileMarker;
          case StructureType.Village:
            return {
              iconSrc: ownedStructureIds.has(normalizeEntityId(tile.occupier_id) ?? "")
                ? LABEL_ICONS.villageMine
                : LABEL_ICONS.villageEnemy,
            } satisfies TileMarker;
          case StructureType.Realm:
            return {
              iconSrc: ownedStructureIds.has(normalizeEntityId(tile.occupier_id) ?? "")
                ? LABEL_ICONS.realmMine
                : LABEL_ICONS.realmEnemy,
            } satisfies TileMarker;
          case StructureType.Hyperstructure:
            return { iconSrc: LABEL_ICONS.hyperstructure, sizeMultiplier: 1.1 } satisfies TileMarker;
          default:
            return null;
        }
      }

      const explorerInfo = getExplorerInfoFromTileOccupier(occupierType);
      if (explorerInfo) {
        const occupierId = normalizeEntityId(tile.occupier_id);
        return {
          iconSrc: occupierId && ownedExplorerIds.has(occupierId) ? LABEL_ICONS.armyMine : LABEL_ICONS.armyEnemy,
          sizeMultiplier: 0.9,
        } satisfies TileMarker;
      }

      return null;
    },
    [ownedStructureIds, ownedExplorerIds, mode],
  );

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startView: { x: number; y: number; scale: number };
    moved: boolean;
  } | null>(null);

  const handlePointerDown = useCallback((e: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    if (followRafRef.current !== null) {
      cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
      followTargetRef.current = null;
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startView: viewRef.current,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.preventDefault();
      const dx = (e.clientX - drag.startClientX) / drag.startView.scale;
      const dy = (e.clientY - drag.startClientY) / drag.startView.scale;
      if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        drag.moved = true;
      }
      const nextX = drag.startView.x - dx;
      const nextY = drag.startView.y - dy;
      scheduleViewUpdate({
        ...drag.startView,
        x: nextX,
        y: nextY,
      });
      if (drag.moved) {
        scheduleCameraMove(nextX, nextY);
      }
    },
    [scheduleViewUpdate, scheduleCameraMove],
  );

  const endDrag = useCallback((e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    isDraggingRef.current = false;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // no-op
    }
  }, []);

  const handleWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window === "undefined") return;
    const direction = Math.sign(e.deltaY);
    if (direction === 0) return;
    window.dispatchEvent(new CustomEvent("minimapZoom", { detail: { zoomOut: direction > 0 } }));
  }, []);

  const handleDoubleClick = useCallback(() => {
    scheduleViewUpdate({ ...initialView });
  }, [initialView, scheduleViewUpdate]);

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox.value}
      className="absolute inset-0 h-full w-full touch-none select-none"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onDoubleClick={handleDoubleClick}
    >
      {visibleTiles.map(({ tile, points, pixel }) => {
        const marker = getTileMarker(tile);
        const fill = getBiomeColor(tile.biome);
        const occupierColor = getOccupierColor(tile);
        const iconSize = marker ? HEX_SIZE * 2.2 * (marker.sizeMultiplier ?? 1) : 0;
        return (
          <g key={`${tile.col}:${tile.row}`}>
            <polygon points={points} fill={fill} stroke="#1f130a" strokeWidth={0.6} fillOpacity={0.92} />
            {occupierColor && !marker && (
              <circle
                cx={pixel.x}
                cy={pixel.y}
                r={HEX_SIZE * 0.45}
                fill={occupierColor}
                stroke="#0f0a07"
                strokeWidth={0.8}
              />
            )}
            {marker && (
              <image
                href={marker.iconSrc}
                x={pixel.x - iconSize / 2}
                y={pixel.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                preserveAspectRatio="xMidYMid meet"
                className="pointer-events-none select-none"
              />
            )}
          </g>
        );
      })}
      {cameraCircle && (
        <g pointerEvents="none">
          <circle
            cx={cameraCircle.centerPixel.x}
            cy={cameraCircle.centerPixel.y}
            r={cameraCircle.radiusPx}
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1}
          />
        </g>
      )}
    </svg>
  );
};
