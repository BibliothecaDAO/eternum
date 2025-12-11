import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { FELT_CENTER } from "@/ui/config";
import { BIOME_COLORS } from "@/three/managers/biome-colors";
import {
  getExplorerInfoFromTileOccupier,
  getStructureInfoFromTileOccupier,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { BiomeIdToType, HexPosition, StructureType } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";

export interface MinimapTile {
  col: number;
  row: number;
  biome?: number;
  occupier_id?: number;
  occupier_type?: number;
  occupier_is_structure?: boolean;
}

export const normalizeMinimapTile = (tile: MinimapTile): MinimapTile => ({
  col: Number(tile.col),
  row: Number(tile.row),
  biome: tile.biome !== undefined ? Number(tile.biome) : undefined,
  occupier_id: tile.occupier_id !== undefined ? Number(tile.occupier_id) : undefined,
  occupier_type: tile.occupier_type !== undefined ? Number(tile.occupier_type) : undefined,
  occupier_is_structure: Boolean(tile.occupier_is_structure),
});

const HEX_SIZE = 7;
const SQRT3 = Math.sqrt(3);
const CAMERA_CIRCLE_SCREEN_RADIUS_PX = 60;

const TILE_MARKERS = {
  essenceRift: { fill: "#8b5cf6", emoji: "⛏️" },
  camp: { fill: "#92400e", emoji: "⛺" },
  owned: { fill: "#22c55e" },
  enemy: { fill: "#ef4444" },
  hyperstructure: { fill: "#facc15", emoji: "⭐" },
  armyOwned: { fill: "#22c55e", emoji: "⚔️" },
  armyEnemy: { fill: "#ef4444", emoji: "⚔️" },
} as const;

const axialToPixel = (col: number, row: number) => {
  const x = HEX_SIZE * (SQRT3 * col + (SQRT3 / 2) * row);
  const y = HEX_SIZE * ((3 / 2) * row);
  return { x, y };
};

const pixelToAxial = (x: number, y: number) => {
  const row = (2 / 3) * (y / HEX_SIZE);
  const col = x / (SQRT3 * HEX_SIZE) - row / 2;
  return { col, row };
};

const axialRound = (col: number, row: number) => {
  let x = col;
  let z = row;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { col: rx, row: rz };
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
    const pixel = axialToPixel(centeredCol, centeredRow);
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
  const currentPlayerData = usePlayerStore((state) => state.currentPlayerData);

  const ownedStructureIds = useMemo(() => {
    return new Set(playerStructures.map((structure) => String(structure.entityId)));
  }, [playerStructures]);

  const ownedExplorerIds = useMemo(() => {
    if (!currentPlayerData?.explorerIds?.length) return new Set<string>();
    return new Set(currentPlayerData.explorerIds.map((entry) => entry.split(":")[0]));
  }, [currentPlayerData]);

  const centeredIndex = useMemo(() => buildCenteredIndex(tiles), [tiles]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[minimap] HexMinimap tiles", {
      count: tiles.length,
      bounds: centeredIndex.bounds,
      columns: centeredIndex.byCol.size,
      sample: tiles[0],
    });
  }, [tiles, centeredIndex]);

  const initialView = useMemo(() => {
    if (!tiles.length) {
      return { x: 0, y: 0, scale: 1.4 };
    }

    const targetHex = cameraTargetHex ?? navigationTarget ?? selectedHex;
    if (targetHex) {
      const col = targetHex.col - FELT_CENTER();
      const row = targetHex.row - FELT_CENTER();
      const centerPixel = axialToPixel(col, row);
      return { x: centerPixel.x, y: centerPixel.y, scale: 1.4 };
    }

    return {
      x: (centeredIndex.bounds.minX + centeredIndex.bounds.maxX) / 2,
      y: (centeredIndex.bounds.minY + centeredIndex.bounds.maxY) / 2,
      scale: 1.4,
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

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[minimap] HexMinimap view", view);
  }, [view]);

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

  const dispatchCameraMove = useCallback((centerX: number, centerY: number) => {
    if (typeof window === "undefined") return;
    const axial = pixelToAxial(centerX, centerY);
    const rounded = axialRound(axial.col, axial.row);
    const col = rounded.col;
    const row = rounded.row;
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
    const centerPixel = axialToPixel(col, row);
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
    const centerPixel = axialToPixel(col, row);
    const radiusPx = CAMERA_CIRCLE_SCREEN_RADIUS_PX / view.scale;
    return { centerPixel, radiusPx };
  }, [cameraTargetHex, view.scale]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[minimap] HexMinimap cameraCircle", {
      cameraTargetHex,
      cameraCircle,
    });
  }, [cameraTargetHex, cameraCircle]);

  const visibleTiles = useMemo(() => {
    if (!tiles.length) return [] as CenteredTileEntry[];

    const paddingPx = HEX_SIZE * 3;
    const minX = viewBox.minX - paddingPx;
    const maxX = viewBox.minX + viewBox.width + paddingPx;
    const minY = viewBox.minY - paddingPx;
    const maxY = viewBox.minY + viewBox.height + paddingPx;

    const minRowFloat = pixelToAxial(0, minY).row;
    const maxRowFloat = pixelToAxial(0, maxY).row;
    const minRow = Math.floor(Math.min(minRowFloat, maxRowFloat)) - 2;
    const maxRow = Math.ceil(Math.max(minRowFloat, maxRowFloat)) + 2;

    const colCandidates = [
      pixelToAxial(minX, minY).col,
      pixelToAxial(minX, maxY).col,
      pixelToAxial(maxX, minY).col,
      pixelToAxial(maxX, maxY).col,
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
      const hasStructure = tile.occupier_is_structure || isTileOccupierStructure(occupierType);

      if (hasStructure) {
        const info = getStructureInfoFromTileOccupier(occupierType);
        if (!info) return null;

        switch (info.type) {
          case StructureType.FragmentMine:
            return TILE_MARKERS.essenceRift;
          case StructureType.Village:
            return TILE_MARKERS.camp;
          case StructureType.Realm: {
            const isMine = ownedStructureIds.has(String(tile.occupier_id));
            return isMine ? { ...TILE_MARKERS.owned, emoji: "👑" } : { ...TILE_MARKERS.enemy, emoji: "👑" };
          }
          case StructureType.Hyperstructure:
            return TILE_MARKERS.hyperstructure;
          default:
            return null;
        }
      }

      const explorerInfo = getExplorerInfoFromTileOccupier(occupierType);
      if (explorerInfo) {
        const isMine = ownedExplorerIds.has(String(tile.occupier_id));
        return isMine ? TILE_MARKERS.armyOwned : TILE_MARKERS.armyEnemy;
      }

      return null;
    },
    [ownedStructureIds, ownedExplorerIds],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[minimap] HexMinimap visibleTiles", {
      visibleCount: visibleTiles.length,
      viewBox: viewBox.value,
      viewport,
    });
  }, [visibleTiles.length, viewBox.value, viewport]);

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

  const handleWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const current = viewRef.current;
      const width = viewport.width / current.scale;
      const height = viewport.height / current.scale;

      const pointerXRatio = (e.clientX - rect.left) / rect.width - 0.5;
      const pointerYRatio = (e.clientY - rect.top) / rect.height - 0.5;

      const pointerWorldX = current.x + pointerXRatio * width;
      const pointerWorldY = current.y + pointerYRatio * height;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const nextScale = clamp(current.scale * zoomFactor, 0.4, 4);

      const nextWidth = viewport.width / nextScale;
      const nextHeight = viewport.height / nextScale;

      const nextX = pointerWorldX - pointerXRatio * nextWidth;
      const nextY = pointerWorldY - pointerYRatio * nextHeight;

      scheduleViewUpdate({ x: nextX, y: nextY, scale: nextScale });
    },
    [scheduleViewUpdate, viewport],
  );

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
        const fill = marker?.fill ?? getBiomeColor(tile.biome);
        const occupierColor = getOccupierColor(tile);
        return (
          <g key={`${tile.col}:${tile.row}`}>
            <polygon points={points} fill={fill} stroke="#1f130a" strokeWidth={0.6} fillOpacity={0.92} />
            {occupierColor && !marker?.emoji && (
              <circle
                cx={pixel.x}
                cy={pixel.y}
                r={HEX_SIZE * 0.45}
                fill={occupierColor}
                stroke="#0f0a07"
                strokeWidth={0.8}
              />
            )}
            {marker?.emoji && (
              <text
                x={pixel.x}
                y={pixel.y}
                fontSize={HEX_SIZE * 1.4}
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
              >
                {marker.emoji}
              </text>
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
          <circle
            cx={cameraCircle.centerPixel.x}
            cy={cameraCircle.centerPixel.y}
            r={HEX_SIZE * 0.5}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={0.6}
          />
        </g>
      )}
    </svg>
  );
};
