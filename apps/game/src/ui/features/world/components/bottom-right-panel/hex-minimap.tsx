import { HexMarker } from "@/ui/design-system/hex-marker";
import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { minimapMarkersView, type MinimapMarker } from "./minimap-markers";
import { latticeHexAt, latticeHexBoundsForWorldRect, latticeToWorld } from "@/three/utils/hex-lattice";
import { fromRenderHex, toRenderHex, worldOrigin } from "@/three/world-origin";
import { WORLDMAP_CAMERA_ZOOM } from "@/three/scenes/worldmap-camera-view-profile";
import {
  readCameraView,
  subscribeCameraView,
  type CameraView,
  type GroundPoint,
} from "@/three/scenes/worldmap-camera-view";
import { useFactView } from "@/hooks/use-fact-view";
import { FELT_CENTER } from "@/ui/config";
import { requireBiomeColor, resolveBiomeTypeFromId } from "@/three/managers/biome-colors";
import {
  getExplorerInfoFromTileOccupier,
  getStructureInfoFromTileOccupier,
  hasTileOccupier,
  isTileOccupierReservedHyperstructure,
  isTileOccupierStructure,
  Position,
} from "@bibliothecadao/eternum";
import { HexPosition, TileOccupier } from "@bibliothecadao/types";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

export interface MinimapTile {
  col: number;
  row: number;
  biome?: number;
  occupier_id?: string;
  occupier_type?: number;
  occupier_is_structure?: boolean;
  mineKind?: number;
}

const normalizeMinimapTile = (tile: MinimapTile): MinimapTile => ({
  mineKind: tile.mineKind,
  col: Number(tile.col),
  row: Number(tile.row),
  biome: tile.biome !== undefined ? Number(tile.biome) : undefined,
  occupier_id: normalizeEntityId(tile.occupier_id) ?? undefined,
  occupier_type: tile.occupier_type !== undefined ? Number(tile.occupier_type) : undefined,
  occupier_is_structure: Boolean(tile.occupier_is_structure),
});

/**
 * Tiles give the minimap its biomes; what stands on a hex comes from the projection's structure index, which also
 * places a Frontier realm on the site it is raised on, where no tile carries it.
 */
export const readMinimapTiles = (
  projection: Pick<WorldSpatialProjection, "getTiles" | "getStructures">,
  alt: boolean,
): MinimapTile[] => {
  const tilesByHex = new Map<string, MinimapTile>();
  for (const tile of projection.getTiles(alt)) {
    tilesByHex.set(`${tile.hexCoords.col}:${tile.hexCoords.row}`, {
      col: tile.hexCoords.col,
      row: tile.hexCoords.row,
      biome: tile.biome,
      occupier_id: tile.occupierId.toString(),
      occupier_type: tile.occupierType,
      occupier_is_structure: tile.occupierIsStructure,
    });
  }
  for (const structure of projection.getStructures(alt)) {
    if (structure.entityId === null || structure.clearedSite) continue;
    const key = `${structure.hexCoords.col}:${structure.hexCoords.row}`;
    tilesByHex.set(key, {
      ...(tilesByHex.get(key) ?? { col: structure.hexCoords.col, row: structure.hexCoords.row }),
      occupier_id: structure.entityId.toString(),
      occupier_type: structure.occupierType,
      occupier_is_structure: true,
    });
  }
  return [...tilesByHex.values()].map(normalizeMinimapTile);
};

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
const TILE_WINDOW_STEP = HEX_SIZE * 8;
/** The minimap's scale at the camera's default distance, for the classic look: the rule below scales it by the zoom. */
const MINIMAP_SCALE_REFERENCE = 1.4;

/**
 * Minimap pixels for a normalized hex: the world map's lattice at minimap scale, drawn relative to the floating world
 * origin so SVG coordinates stay small wherever the map is looked at.
 */
const offsetToPixel = (col: number, row: number) => {
  const render = toRenderHex(col, row);
  const { x, z } = latticeToWorld(render.col, render.row);
  return { x: x * HEX_SIZE, y: z * HEX_SIZE };
};

const pixelToOffset = (x: number, y: number) => {
  const render = latticeHexAt(x / HEX_SIZE, y / HEX_SIZE);
  return fromRenderHex(render.col, render.row);
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
  const biome = resolveBiomeTypeFromId(biomeId);
  return biome ? requireBiomeColor(biome).getStyle() : "#4b5563";
};

const getOccupierColor = (tile: MinimapTile) => {
  const type = tile.occupier_type ?? 0;
  if (!hasTileOccupier(type)) return null;
  if (type === TileOccupier.Spire) return "#67e8f9";
  if (isTileOccupierReservedHyperstructure(type as TileOccupier)) return "#fbbf24";
  const isStructure = isTileOccupierStructure(type);
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

  byCol.forEach((entries, col) =>
    byCol.set(
      col,
      entries.toSorted((a, b) => a.centeredRow - b.centeredRow),
    ),
  );

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

/** Sites the world places with no entity of their own: the tile's occupier alone names them. */
const SITE_MEANINGS: Partial<Record<number, MinimapMarker["name"]>> = {
  [TileOccupier.Spire]: "spire",
  [TileOccupier.DormantSpire]: "spire",
  [TileOccupier.Shrine]: "shrine",
  [TileOccupier.Well]: "well",
  [TileOccupier.ReservedHyperstructure]: "hyperstructure",
  [TileOccupier.Chest]: "chest",
};

/**
 * A tile's marker, read from what occupies it first: an empty tile has none, whatever entity id it still carries; a
 * known entity's own marker; else the occupier's meaning. A zero or missing id is no entity, so never looked up.
 */
const resolveTileMarker = (tile: MinimapTile, markers: ReadonlyMap<string, MinimapMarker>): MinimapMarker | null => {
  const type = tile.occupier_type ?? 0;
  if (!hasTileOccupier(type)) return null;
  const id = tile.occupier_id ?? "";
  const known = id && id !== "0" ? markers.get(id) : undefined;
  if (known) return known;
  const site = SITE_MEANINGS[type];
  if (site) return { name: site, owner: "neutral" };
  const structure = getStructureInfoFromTileOccupier(type);
  if (structure) return { name: structureMeaning(structure.type), owner: "neutral" };
  if (getExplorerInfoFromTileOccupier(type)) return { name: "map-army", owner: "neutral" };
  return null;
};

/**
 * How the minimap draws. "classic" is the shipped look. "badges" (the HUD rework's) draws the hexes larger, so each
 * occupant's painted badge fills its hex at a readable size, over terrain dimmed behind them.
 */
type MinimapLook = "classic" | "badges";

/**
 * `zoom` scales the minimap against the camera ("badges" draws closer, so each badge fills its hex at a readable size);
 * `closest` is the largest scale, where a minimap about 320 px wide still shows some seven hexes across, more than the
 * closest camera. "badges" dims its terrain behind the badges.
 */
const LOOKS: Record<MinimapLook, { zoom: number; closest: number; terrainOpacity: number }> = {
  classic: { zoom: 1, closest: 4, terrainOpacity: 0.92 },
  badges: { zoom: 1.75, closest: 3.5, terrainOpacity: 0.5 },
};

type Framing = { x: number; y: number; scale: number };

/** Minimap pixels for a ground point of the camera's view (world units around the same origin as the tiles). */
const groundToPixel = (point: GroundPoint) => ({ x: point.x * HEX_SIZE, y: point.z * HEX_SIZE });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The minimap's scale at a camera distance: it draws back as the camera does, so it shows more ground the farther the
 * camera stands, scaled by the look and held at its closest.
 */
const scaleAt = (distance: number, look: MinimapLook) => {
  const { zoom, closest } = LOOKS[look];
  return clamp(
    ((MINIMAP_SCALE_REFERENCE * WORLDMAP_CAMERA_ZOOM.defaultDistance) / distance) * zoom,
    0.4 * zoom,
    closest,
  );
};

/** The minimap's framing for a camera view: on the point the camera looks at, at the scale of its distance. */
const framingFor = (view: CameraView, look: MinimapLook): Framing => ({
  ...groundToPixel(view.target),
  scale: scaleAt(view.distance, look),
});

/** The minimap pixels a framing shows on a viewport. */
const boxOf = (framing: Framing, viewport: { width: number; height: number }) => {
  const width = viewport.width / framing.scale;
  const height = viewport.height / framing.scale;
  return { minX: framing.x - width / 2, minY: framing.y - height / 2, width, height };
};

/** The tiles drawn are those of a window around the view, grown once the view leaves it or shrinks well inside it. */
type TileWindow = { minX: number; minY: number; maxX: number; maxY: number };
const windowAround = (box: { minX: number; minY: number; width: number; height: number }): TileWindow => ({
  minX: Math.floor((box.minX - box.width / 2) / TILE_WINDOW_STEP) * TILE_WINDOW_STEP - HEX_SIZE,
  minY: Math.floor((box.minY - box.height / 2) / TILE_WINDOW_STEP) * TILE_WINDOW_STEP - HEX_SIZE,
  maxX: Math.ceil((box.minX + box.width * 1.5) / TILE_WINDOW_STEP) * TILE_WINDOW_STEP + HEX_SIZE,
  maxY: Math.ceil((box.minY + box.height * 1.5) / TILE_WINDOW_STEP) * TILE_WINDOW_STEP + HEX_SIZE,
});
const windowHolds = (window: TileWindow, box: { minX: number; minY: number; width: number; height: number }) =>
  box.minX >= window.minX &&
  box.minY >= window.minY &&
  box.minX + box.width <= window.maxX &&
  box.minY + box.height <= window.maxY &&
  window.maxX - window.minX <= box.width * 4;

interface HexMinimapProps {
  tiles: MinimapTile[];
  selectedHex: HexPosition | null;
  navigationTarget: HexPosition | null;
  cameraTargetHex: HexPosition | null;
  look?: MinimapLook;
}

export const HexMinimap = ({
  tiles,
  selectedHex,
  navigationTarget,
  cameraTargetHex,
  look = "classic",
}: HexMinimapProps) => {
  const { terrainOpacity } = LOOKS[look];
  const svgRef = useRef<SVGSVGElement | null>(null);
  const markers = useFactView(minimapMarkersView);
  const viewportRef = useRef({ width: 320, height: 320 });
  // The origin the camera's view is drawn around: the tiles are placed about the same one.
  const [origin, setOrigin] = useState(() => originKey(readCameraView()));
  const centeredIndex = useMemo(() => buildCenteredIndex(tiles), [tiles, origin]);

  /** Before the camera first tells what it sees (another scene first, the lab): its hex, else a target, else the map. */
  const fallback = useMemo((): Framing => {
    const targetHex = cameraTargetHex ?? navigationTarget ?? selectedHex;
    if (targetHex) {
      const center = offsetToPixel(targetHex.col - FELT_CENTER(), targetHex.row - FELT_CENTER());
      return { ...center, scale: scaleAt(WORLDMAP_CAMERA_ZOOM.defaultDistance, look) };
    }
    const { bounds } = centeredIndex;
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      scale: scaleAt(WORLDMAP_CAMERA_ZOOM.defaultDistance, look),
    };
  }, [cameraTargetHex, navigationTarget, selectedHex, centeredIndex, look]);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const framingRef = useRef<Framing>(fallback);
  // The first render already draws the tiles about the camera's view (or the fallback), before any layout.
  const [tileWindow, setTileWindow] = useState<TileWindow>(() => {
    const view = readCameraView();
    return windowAround(boxOf(view ? framingFor(view, look) : fallback, viewportRef.current));
  });
  const tileWindowRef = useRef(tileWindow);

  /**
   * Frames the minimap on the camera, written straight to the SVG so it moves in the frame the camera does; the tiles
   * render again only once the framing leaves their window.
   */
  const draw = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const view = readCameraView();
    const viewport = viewportRef.current;
    const framing = view ? framingFor(view, look) : fallbackRef.current;
    framingRef.current = framing;
    const box = boxOf(framing, viewport);
    svg.setAttribute("viewBox", `${box.minX} ${box.minY} ${box.width} ${box.height}`);
    if (!windowHolds(tileWindowRef.current, box)) {
      const next = windowAround(box);
      tileWindowRef.current = next;
      setTileWindow(next);
    }
  }, [look]);

  useLayoutEffect(draw);

  useEffect(() => {
    return subscribeCameraView((view) => {
      const key = originKey(view);
      setOrigin((current) => (current === key ? current : key));
      draw();
    });
  }, [draw]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      viewportRef.current = { width: rect.width, height: rect.height };
      draw();
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [draw]);

  const dispatchCameraMove = useCallback((centerX: number, centerY: number) => {
    if (typeof window === "undefined") return;
    const { col, row } = pixelToOffset(centerX, centerY);
    // The minimap draws scene hexes: the map position it names is a normalized one.
    window.dispatchEvent(new CustomEvent("minimapCameraMove", { detail: Position.fromNormalized({ x: col, y: row }) }));
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

  const visibleTiles = useMemo(() => {
    if (!tiles.length) return [] as CenteredTileEntry[];
    const { minX, minY, maxX, maxY } = tileWindow;

    // The window is in minimap pixels relative to the world origin; tiles are indexed by normalized hex.
    const window = latticeHexBoundsForWorldRect({
      minX: minX / HEX_SIZE,
      minZ: minY / HEX_SIZE,
      maxX: maxX / HEX_SIZE,
      maxZ: maxY / HEX_SIZE,
    });
    const { col: minCol, row: minRow } = fromRenderHex(window.minCol - 1, window.minRow - 1);
    const { col: maxCol, row: maxRow } = fromRenderHex(window.maxCol + 1, window.maxRow + 1);

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
  }, [tiles.length, centeredIndex.byCol, tileWindow]);

  const getTileMarker = useCallback((tile: MinimapTile) => resolveTileMarker(tile, markers), [markers]);

  const tileElements = useMemo(
    () =>
      visibleTiles.map(({ tile, points, pixel }) => {
        const marker = getTileMarker(tile);
        const fill = getBiomeColor(tile.biome);
        const occupierColor = getOccupierColor(tile);
        return (
          <g key={`${tile.col}:${tile.row}`}>
            <polygon points={points} fill={fill} stroke="#1f130a" strokeWidth={0.6} fillOpacity={terrainOpacity} />
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
            {marker && <HexMarker {...marker} x={pixel.x} y={pixel.y} radius={HEX_SIZE} />}
          </g>
        );
      }),
    [visibleTiles, getTileMarker, terrainOpacity],
  );

  /** A drag moves the camera's target with the pointer; the minimap follows the camera as it moves. */
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startTarget: { x: number; y: number };
    scale: number;
    moved: boolean;
  } | null>(null);

  const handlePointerDown = useCallback((e: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture(e.pointerId);
    const view = readCameraView();
    const framing = framingRef.current;
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTarget: view ? groundToPixel(view.target) : { x: framing.x, y: framing.y },
      scale: framing.scale,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.preventDefault();
      const dx = (e.clientX - drag.startClientX) / drag.scale;
      const dy = (e.clientY - drag.startClientY) / drag.scale;
      if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        drag.moved = true;
      }
      if (drag.moved) {
        scheduleCameraMove(drag.startTarget.x - dx, drag.startTarget.y - dy);
      }
    },
    [scheduleCameraMove],
  );

  const endDrag = useCallback((e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
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

  useEffect(() => {
    return () => {
      // StrictMode and Fast Refresh replay effects while preserving refs. A cancelled handle must not
      // keep the next effect from scheduling its animation.
      if (cameraMoveRafRef.current !== null) cancelAnimationFrame(cameraMoveRafRef.current);
      cameraMoveRafRef.current = null;
      pendingCameraMoveRef.current = null;
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full touch-none select-none"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      {tileElements}
    </svg>
  );
};

/** The floating origin a camera view is drawn around, as a key; the origin's own when the camera has not told yet. */
const originKey = (view: CameraView | null): string => {
  const origin = view?.origin ?? worldOrigin();
  return `${origin.col}:${origin.row}`;
};
