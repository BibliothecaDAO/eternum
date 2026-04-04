import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { WorldmapStrategicVisualPolicy } from "@/three/scenes/worldmap-navigation/worldmap-strategic-visual-policy";
import type { HexPosition } from "@bibliothecadao/types";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import {
  type CenteredTileEntry,
  type MinimapTile,
  buildCenteredIndex,
  centeredHexToContractHex,
  contractHexToCenteredHex,
  lookupCenteredEntryForPixel,
  normalizeEntityId,
  offsetToPixel,
  pixelToOffset,
} from "./strategic-map-coordinates";
import { getOccupierColor, resolveStrategicMapTileMarker } from "./strategic-map-markers";
import {
  resolveStrategicBiomeFill,
  resolveStrategicMapModeStyle,
  resolveStrategicMarkerChrome,
  type StrategicMapRenderMode,
} from "./strategic-map-style-profile";
import {
  resolveStrategicMapInitialView,
  resolveStrategicMapViewBox,
  type StrategicMapView,
} from "./strategic-map-viewport";

const CAMERA_CIRCLE_SCREEN_RADIUS_PX = 60;

interface StrategicMapRendererProps {
  renderMode: StrategicMapRenderMode;
  tiles: MinimapTile[];
  selectedHex: HexPosition | null;
  navigationTarget: HexPosition | null;
  cameraTargetHex: HexPosition | null;
  centerHex?: HexPosition | null;
  scale: number;
  interactive?: boolean;
  showCameraCircle?: boolean;
  resetOnDoubleClick?: boolean;
  className?: string;
  onPanToHex?: (hex: HexPosition) => void;
  onZoomDelta?: (delta: number) => void;
  onSelectHex?: (hex: HexPosition) => void;
  onActivateHex?: (hex: HexPosition) => void;
  visualPolicy?: Pick<
    WorldmapStrategicVisualPolicy,
    | "strategicSurfaceOpacity"
    | "strategicMarkerOpacity"
    | "strategicMarkerScale"
    | "selectionRingOpacity"
    | "unexploredMaskOpacity"
  >;
}

export const StrategicMapRenderer = ({
  renderMode,
  tiles,
  selectedHex,
  navigationTarget,
  cameraTargetHex,
  centerHex,
  scale,
  interactive = true,
  showCameraCircle = false,
  resetOnDoubleClick = false,
  className,
  onPanToHex,
  onZoomDelta,
  onSelectHex,
  onActivateHex,
  visualPolicy,
}: StrategicMapRendererProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const svgDefsId = useId().replace(/:/g, "-");
  const [viewport, setViewport] = useState({ width: 800, height: 600 });
  const playerStructures = useUIStore((state) => state.playerStructures);
  const selectableArmies = useUIStore((state) => state.selectableArmies);
  const currentPlayerData = usePlayerStore((state) => state.currentPlayerData);
  const mode = useGameModeConfig();
  const modeStyle = useMemo(
    () =>
      resolveStrategicMapModeStyle({
        renderMode,
        visualPolicy,
      }),
    [renderMode, visualPolicy],
  );

  const ownedStructureIds = useMemo(() => {
    return new Set(
      playerStructures
        .map((structure) => normalizeEntityId(structure.entityId))
        .filter((entityId): entityId is string => Boolean(entityId)),
    );
  }, [playerStructures]);

  const ownedExplorerIds = useMemo(() => {
    const ids = new Set<string>();

    selectableArmies.forEach((army) => {
      const entityId = normalizeEntityId(army.entityId);
      if (entityId) {
        ids.add(entityId);
      }
    });

    currentPlayerData?.explorerIds?.forEach((entry) => {
      const [entityId] = entry.split(":");
      const normalizedEntityId = normalizeEntityId(entityId);
      if (normalizedEntityId) {
        ids.add(normalizedEntityId);
      }
    });

    return ids;
  }, [currentPlayerData, selectableArmies]);

  const centeredIndex = useMemo(() => buildCenteredIndex(tiles), [tiles]);
  const trackedCenterHex = centerHex ?? cameraTargetHex ?? navigationTarget ?? selectedHex;
  const initialView = useMemo(
    () =>
      resolveStrategicMapInitialView({
        centerHex: trackedCenterHex,
        bounds: centeredIndex.bounds,
        scale,
        hasTiles: tiles.length > 0,
      }),
    [centeredIndex.bounds, scale, tiles.length, trackedCenterHex],
  );

  const [view, setView] = useState<StrategicMapView>(initialView);
  const viewRef = useRef(view);
  viewRef.current = view;

  const isDraggingRef = useRef(false);
  const followTargetRef = useRef<{ x: number; y: number } | null>(null);
  const followRafRef = useRef<number | null>(null);
  const pendingViewRef = useRef<StrategicMapView | null>(null);
  const viewRafRef = useRef<number | null>(null);
  const pendingPanHexRef = useRef<HexPosition | null>(null);
  const panRafRef = useRef<number | null>(null);

  const scheduleViewUpdate = useCallback((nextView: StrategicMapView) => {
    pendingViewRef.current = nextView;
    if (viewRafRef.current !== null) {
      return;
    }

    viewRafRef.current = requestAnimationFrame(() => {
      viewRafRef.current = null;
      if (!pendingViewRef.current) {
        return;
      }

      setView(pendingViewRef.current);
      pendingViewRef.current = null;
    });
  }, []);

  const schedulePanToHex = useCallback(
    (centerX: number, centerY: number) => {
      if (!onPanToHex) {
        return;
      }

      const centeredHex = pixelToOffset(centerX, centerY);
      const contractHex = centeredHexToContractHex(centeredHex);

      pendingPanHexRef.current = contractHex;
      if (panRafRef.current !== null) {
        return;
      }

      panRafRef.current = requestAnimationFrame(() => {
        panRafRef.current = null;
        const nextHex = pendingPanHexRef.current;
        pendingPanHexRef.current = null;
        if (nextHex) {
          onPanToHex(nextHex);
        }
      });
    },
    [onPanToHex],
  );

  const startFollowAnimation = useCallback(() => {
    if (followRafRef.current !== null) {
      return;
    }

    const tick = () => {
      followRafRef.current = null;
      const target = followTargetRef.current;
      if (!target || isDraggingRef.current) {
        return;
      }

      const currentView = viewRef.current;
      const nextView = {
        ...currentView,
        x: currentView.x + (target.x - currentView.x) * 0.18,
        y: currentView.y + (target.y - currentView.y) * 0.18,
      };
      const done = Math.hypot(target.x - nextView.x, target.y - nextView.y) < 0.5;
      const resolvedView = done
        ? {
            ...currentView,
            x: target.x,
            y: target.y,
          }
        : nextView;

      setView(resolvedView);
      viewRef.current = resolvedView;

      if (done) {
        followTargetRef.current = null;
        return;
      }

      followRafRef.current = requestAnimationFrame(tick);
    };

    followRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const currentView = viewRef.current;
    if (Math.abs(currentView.scale - scale) < 0.001) {
      return;
    }

    scheduleViewUpdate({
      ...currentView,
      scale,
    });
  }, [scale, scheduleViewUpdate]);

  useEffect(() => {
    if (!trackedCenterHex || isDraggingRef.current) {
      return;
    }

    const centered = contractHexToCenteredHex(trackedCenterHex);
    const pixel = offsetToPixel(centered.col, centered.row);
    followTargetRef.current = pixel;
    startFollowAnimation();
  }, [startFollowAnimation, trackedCenterHex]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height) {
        setViewport({
          width: rect.width,
          height: rect.height,
        });
      }
    });
    observer.observe(svg);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (followRafRef.current !== null) {
        cancelAnimationFrame(followRafRef.current);
      }
      if (viewRafRef.current !== null) {
        cancelAnimationFrame(viewRafRef.current);
      }
      if (panRafRef.current !== null) {
        cancelAnimationFrame(panRafRef.current);
      }
    };
  }, []);

  const viewBox = useMemo(
    () =>
      resolveStrategicMapViewBox({
        view,
        viewport,
      }),
    [view, viewport],
  );

  const visibleTiles = useMemo(() => {
    if (tiles.length === 0) {
      return [] as CenteredTileEntry[];
    }

    const paddingPx = 21;
    const minX = viewBox.minX - paddingPx;
    const maxX = viewBox.minX + viewBox.width + paddingPx;
    const minY = viewBox.minY - paddingPx;
    const maxY = viewBox.minY + viewBox.height + paddingPx;
    const result: CenteredTileEntry[] = [];

    centeredIndex.byCol.forEach((entries) => {
      entries.forEach((entry) => {
        if (
          entry.bounds.maxX < minX ||
          entry.bounds.minX > maxX ||
          entry.bounds.maxY < minY ||
          entry.bounds.minY > maxY
        ) {
          return;
        }

        result.push(entry);
      });
    });

    return result;
  }, [centeredIndex.byCol, tiles.length, viewBox]);

  const cameraCircle = useMemo(() => {
    if (!showCameraCircle || !cameraTargetHex) {
      return null;
    }

    const centered = contractHexToCenteredHex(cameraTargetHex);
    const centerPixel = offsetToPixel(centered.col, centered.row);
    return {
      centerPixel,
      radiusPx: CAMERA_CIRCLE_SCREEN_RADIUS_PX / view.scale,
    };
  }, [cameraTargetHex, showCameraCircle, view.scale]);

  const focusVisuals = useMemo(() => {
    const focusedHex = selectedHex ?? centerHex ?? cameraTargetHex ?? navigationTarget;
    if (!focusedHex) {
      return null;
    }

    const focusedCenteredHex = contractHexToCenteredHex(focusedHex);
    return {
      pixel: offsetToPixel(focusedCenteredHex.col, focusedCenteredHex.row),
      badgeLabel: selectedHex ? "Selected" : "Focus",
    };
  }, [cameraTargetHex, centerHex, navigationTarget, selectedHex]);

  const getTileMarker = useCallback(
    (tile: MinimapTile) =>
      resolveStrategicMapTileMarker({
        tile,
        ownedStructureIds,
        ownedExplorerIds,
        fragmentMineIconSrc: mode.assets.labels.fragmentMine,
      }),
    [mode.assets.labels.fragmentMine, ownedExplorerIds, ownedStructureIds],
  );

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startView: StrategicMapView;
    moved: boolean;
  } | null>(null);

  const resolveEventHex = useCallback(
    (event: PointerEvent<SVGSVGElement> | MouseEvent | WheelEvent<SVGSVGElement>): HexPosition | null => {
      const svg = svgRef.current;
      if (!svg) {
        return null;
      }

      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }

      const localX = viewBox.minX + ((event.clientX - rect.left) / rect.width) * viewBox.width;
      const localY = viewBox.minY + ((event.clientY - rect.top) / rect.height) * viewBox.height;
      const entry = lookupCenteredEntryForPixel(centeredIndex, localX, localY);
      if (!entry) {
        return null;
      }

      return {
        col: entry.tile.col,
        row: entry.tile.row,
      };
    },
    [centeredIndex, viewBox],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (!interactive || !svgRef.current) {
        return;
      }

      svgRef.current.setPointerCapture(event.pointerId);
      isDraggingRef.current = true;
      dragRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startView: viewRef.current,
        moved: false,
      };
    },
    [interactive],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!interactive || !drag || drag.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const dx = (event.clientX - drag.startClientX) / drag.startView.scale;
      const dy = (event.clientY - drag.startClientY) / drag.startView.scale;

      if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        drag.moved = true;
      }

      const nextView = {
        ...drag.startView,
        x: drag.startView.x - dx,
        y: drag.startView.y - dy,
      };
      scheduleViewUpdate(nextView);
      if (drag.moved) {
        schedulePanToHex(nextView.x, nextView.y);
      }
    },
    [interactive, schedulePanToHex, scheduleViewUpdate],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
      isDraggingRef.current = false;
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }

      if (!interactive || drag.moved || !onSelectHex) {
        return;
      }

      const hex = resolveEventHex(event);
      if (hex) {
        onSelectHex(hex);
      }
    },
    [interactive, onSelectHex, resolveEventHex],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      if (!interactive || !onZoomDelta) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY === 0) {
        return;
      }

      onZoomDelta(event.deltaY);
    },
    [interactive, onZoomDelta],
  );

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const hex = resolveEventHex(event.nativeEvent);
      if (hex && onActivateHex) {
        onActivateHex(hex);
        return;
      }

      if (resetOnDoubleClick) {
        scheduleViewUpdate(initialView);
      }
    },
    [initialView, onActivateHex, resetOnDoubleClick, resolveEventHex, scheduleViewUpdate],
  );

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox.value}
      className={className ?? "absolute inset-0 h-full w-full touch-none select-none"}
      onDoubleClick={handleDoubleClick}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <radialGradient id={`${svgDefsId}-mask`} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#000000" stopOpacity={0} />
          <stop offset="72%" stopColor="#0c0908" stopOpacity={0.06} />
          <stop offset="100%" stopColor="#070504" stopOpacity={1} />
        </radialGradient>
        <filter id={`${svgDefsId}-marker-shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.6" floodColor="rgba(0,0,0,0.38)" />
        </filter>
      </defs>
      <rect
        x={viewBox.minX}
        y={viewBox.minY}
        width={viewBox.width}
        height={viewBox.height}
        fill={`url(#${svgDefsId}-mask)`}
        opacity={modeStyle.unexploredMaskOpacity}
        pointerEvents="none"
      />
      {visibleTiles.map(({ tile, pixel, points }) => {
        const marker = getTileMarker(tile);
        const occupierColor = getOccupierColor(tile);
        const markerChrome = marker
          ? resolveStrategicMarkerChrome({
              marker,
              renderMode,
              markerScale: modeStyle.markerScale,
            })
          : null;

        return (
          <g key={`${tile.col}:${tile.row}`}>
            <polygon
              points={points}
              fill={resolveStrategicBiomeFill(tile.biome, renderMode)}
              stroke={modeStyle.tileStroke}
              strokeWidth={modeStyle.tileStrokeWidth}
              strokeOpacity={modeStyle.tileStrokeOpacity}
              fillOpacity={modeStyle.tileFillOpacity}
            />
            {occupierColor && !marker ? (
              <circle
                cx={pixel.x}
                cy={pixel.y}
                r={modeStyle.fallbackOccupierRadius}
                fill={occupierColor}
                fillOpacity={modeStyle.markerOpacity}
                stroke="#0f0a07"
                strokeOpacity={0.5}
                strokeWidth={0.75}
              />
            ) : null}
            {marker && markerChrome ? (
              <g filter={`url(#${svgDefsId}-marker-shadow)`} pointerEvents="none">
                <circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r={markerChrome.badgeRadius}
                  fill={markerChrome.badgeFill}
                  fillOpacity={modeStyle.markerBadgeOpacity}
                  stroke={markerChrome.badgeStroke}
                  strokeOpacity={modeStyle.markerBadgeStrokeOpacity}
                  strokeWidth={0.9}
                />
                <image
                  href={marker.iconSrc}
                  x={pixel.x - markerChrome.iconSize / 2}
                  y={pixel.y - markerChrome.iconSize / 2}
                  width={markerChrome.iconSize}
                  height={markerChrome.iconSize}
                  opacity={modeStyle.markerOpacity}
                  preserveAspectRatio="xMidYMid meet"
                  className="pointer-events-none select-none"
                />
              </g>
            ) : null}
          </g>
        );
      })}
      {focusVisuals ? (
        <g pointerEvents="none">
          <circle
            cx={focusVisuals.pixel.x}
            cy={focusVisuals.pixel.y}
            r={modeStyle.focusRingRadius}
            fill={modeStyle.focusRingFill}
            fillOpacity={modeStyle.focusRingFillOpacity}
            stroke={modeStyle.focusRingStroke}
            strokeOpacity={modeStyle.focusRingStrokeOpacity}
            strokeWidth={1.35}
          />
          <circle
            cx={focusVisuals.pixel.x}
            cy={focusVisuals.pixel.y}
            r={modeStyle.focusRingRadius * 0.33}
            fill={modeStyle.focusRingStroke}
            fillOpacity={Math.max(modeStyle.focusRingStrokeOpacity - 0.18, 0.18)}
          />
          {renderMode === "strategic" && modeStyle.focusBadgeOpacity > 0 ? (
            <g
              transform={`translate(${focusVisuals.pixel.x + modeStyle.focusRingRadius + 4}, ${focusVisuals.pixel.y - 16})`}
            >
              <rect
                x={0}
                y={0}
                rx={7}
                ry={7}
                width={54}
                height={16}
                fill={modeStyle.focusBadgeFill}
                fillOpacity={modeStyle.focusBadgeOpacity}
                stroke={modeStyle.focusBadgeStroke}
                strokeOpacity={0.52}
                strokeWidth={0.8}
              />
              <text
                x={27}
                y={11.5}
                fill={modeStyle.focusBadgeText}
                fontSize={6.8}
                fontWeight={600}
                letterSpacing="0.18em"
                textAnchor="middle"
              >
                {focusVisuals.badgeLabel.toUpperCase()}
              </text>
            </g>
          ) : null}
        </g>
      ) : null}
      {cameraCircle ? (
        <g pointerEvents="none">
          <circle
            cx={cameraCircle.centerPixel.x}
            cy={cameraCircle.centerPixel.y}
            r={cameraCircle.radiusPx}
            fill={modeStyle.cameraCircleStroke}
            fillOpacity={modeStyle.cameraCircleFillOpacity}
            stroke={modeStyle.cameraCircleStroke}
            strokeOpacity={modeStyle.cameraCircleOpacity}
            strokeWidth={modeStyle.cameraCircleStrokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}
    </svg>
  );
};
