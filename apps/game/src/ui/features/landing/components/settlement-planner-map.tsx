import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import {
  getPlannerHexPoints,
  getSettlementPlannerBiomeFill,
  getSettlementPlannerTargetKey,
  resolveSettlementPlannerTarget,
  settlementPlannerHexRadius,
  type SettlementPlannerData,
  type SettlementPlannerTarget,
} from "./settlement-planner-utils";

interface SettlementPlannerMapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface SettlementPlannerMapCamera {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SettlementPlannerMapProps {
  plannerData: SettlementPlannerData;
  selectedTarget: SettlementPlannerTarget | null;
  onSelectTarget: (target: SettlementPlannerTarget) => void;
  className?: string;
  mapHeightClassName?: string;
  isLoading?: boolean;
}

const SLOT_RADIUS = settlementPlannerHexRadius;
const REALM_MARKER_RADIUS = 6;
const VILLAGE_SLOT_RADIUS = 4.5;

const getPlannerMapBounds = ({
  terrainTiles,
  realmSlots,
  realms,
  villageSlots,
}: SettlementPlannerData): SettlementPlannerMapBounds => {
  const points = [...terrainTiles, ...realmSlots, ...realms, ...villageSlots];

  if (points.length === 0) {
    return {
      minX: -160,
      maxX: 160,
      minY: -140,
      maxY: 140,
      width: 320,
      height: 280,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.pixelX - SLOT_RADIUS);
    maxX = Math.max(maxX, point.pixelX + SLOT_RADIUS);
    minY = Math.min(minY, point.pixelY - SLOT_RADIUS);
    maxY = Math.max(maxY, point.pixelY + SLOT_RADIUS);
  }

  const padding = 26;
  const boundedMinX = minX - padding;
  const boundedMaxX = maxX + padding;
  const boundedMinY = minY - padding;
  const boundedMaxY = maxY + padding;

  return {
    minX: boundedMinX,
    maxX: boundedMaxX,
    minY: boundedMinY,
    maxY: boundedMaxY,
    width: Math.max(1, boundedMaxX - boundedMinX),
    height: Math.max(1, boundedMaxY - boundedMinY),
  };
};

const getPlannerPanOverscan = (bounds: SettlementPlannerMapBounds) => ({
  x: Math.max(90, bounds.width * 0.2),
  y: Math.max(90, bounds.height * 0.2),
});

const clampPlannerCamera = (
  camera: SettlementPlannerMapCamera,
  bounds: SettlementPlannerMapBounds,
): SettlementPlannerMapCamera => {
  const overscan = getPlannerPanOverscan(bounds);
  const minWidth = Math.max(120, bounds.width * 0.15);
  const minHeight = Math.max(120, bounds.height * 0.15);
  const width = Math.max(minWidth, Math.min(camera.width, bounds.width));
  const height = Math.max(minHeight, Math.min(camera.height, bounds.height));
  const minPanX = bounds.minX - overscan.x;
  const minPanY = bounds.minY - overscan.y;
  const maxPanX = bounds.maxX + overscan.x - width;
  const maxPanY = bounds.maxY + overscan.y - height;

  return {
    x: Math.max(minPanX, Math.min(camera.x, maxPanX)),
    y: Math.max(minPanY, Math.min(camera.y, maxPanY)),
    width,
    height,
  };
};

const buildPlannerDefaultCamera = (bounds: SettlementPlannerMapBounds): SettlementPlannerMapCamera => ({
  x: bounds.minX,
  y: bounds.minY,
  width: bounds.width,
  height: bounds.height,
});

const plannerCameraToViewBox = (camera: SettlementPlannerMapCamera) =>
  `${camera.x} ${camera.y} ${camera.width} ${camera.height}`;

const getWorldPointFromClient = (svg: SVGSVGElement, clientX: number, clientY: number) => {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  const pointer = svg.createSVGPoint();
  pointer.x = clientX;
  pointer.y = clientY;
  const world = pointer.matrixTransform(ctm.inverse());

  return { x: world.x, y: world.y };
};

export const SettlementPlannerMap = ({
  plannerData,
  selectedTarget,
  onSelectTarget,
  className,
  mapHeightClassName = "h-[360px] md:h-[560px]",
  isLoading = false,
}: SettlementPlannerMapProps) => {
  const mapBounds = useMemo(() => getPlannerMapBounds(plannerData), [plannerData]);
  const defaultMapCamera = useMemo(() => buildPlannerDefaultCamera(mapBounds), [mapBounds]);
  const [mapCamera, setMapCamera] = useState<SettlementPlannerMapCamera | null>(null);
  const [hoveredTargetKey, setHoveredTargetKey] = useState<string | null>(null);
  const mapSvgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startCamera: SettlementPlannerMapCamera;
    hasMoved: boolean;
  } | null>(null);

  const selectedTargetKey = getSettlementPlannerTargetKey(selectedTarget);
  const freeRealmCount = useMemo(
    () => plannerData.realmSlots.filter((slot) => !slot.occupied).length,
    [plannerData.realmSlots],
  );
  const freeVillageCount = useMemo(
    () => plannerData.villageSlots.filter((slot) => !slot.occupied && !slot.pending).length,
    [plannerData.villageSlots],
  );

  useEffect(() => {
    setMapCamera((current) => (current ? clampPlannerCamera(current, mapBounds) : defaultMapCamera));
  }, [defaultMapCamera, mapBounds]);

  const viewBox = useMemo(() => plannerCameraToViewBox(mapCamera ?? defaultMapCamera), [defaultMapCamera, mapCamera]);

  const handleMapWheel = useCallback(
    (event: WheelEvent) => {
      const svg = mapSvgRef.current;
      if (!svg) return;

      event.preventDefault();
      event.stopPropagation();

      const currentCamera = mapCamera ?? defaultMapCamera;
      const worldPoint = getWorldPointFromClient(svg, event.clientX, event.clientY);
      if (!worldPoint) return;

      const zoom = event.deltaY > 0 ? 1.12 : 0.88;
      const width = currentCamera.width * zoom;
      const height = currentCamera.height * zoom;
      const cursorRatioX = (worldPoint.x - currentCamera.x) / currentCamera.width;
      const cursorRatioY = (worldPoint.y - currentCamera.y) / currentCamera.height;

      setMapCamera(
        clampPlannerCamera(
          {
            x: worldPoint.x - width * cursorRatioX,
            y: worldPoint.y - height * cursorRatioY,
            width,
            height,
          },
          mapBounds,
        ),
      );
    },
    [defaultMapCamera, mapBounds, mapCamera],
  );

  useEffect(() => {
    const svg = mapSvgRef.current;
    if (!svg) return;

    svg.addEventListener("wheel", handleMapWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleMapWheel);
  }, [handleMapWheel]);

  const updateHoverFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const svg = mapSvgRef.current;
      if (!svg) return;
      const worldPoint = getWorldPointFromClient(svg, clientX, clientY);
      if (!worldPoint) return;

      const hoverTarget = resolveSettlementPlannerTarget({
        x: worldPoint.x,
        y: worldPoint.y,
        ...plannerData,
      });

      setHoveredTargetKey(getSettlementPlannerTargetKey(hoverTarget));
    },
    [plannerData],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      const currentCamera = mapCamera ?? defaultMapCamera;
      dragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCamera: currentCamera,
        hasMoved: false,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [defaultMapCamera, mapCamera],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        updateHoverFromEvent(event.clientX, event.clientY);
        return;
      }

      const svg = mapSvgRef.current;
      if (!svg) return;

      const startWorld = getWorldPointFromClient(svg, dragState.startClientX, dragState.startClientY);
      const currentWorld = getWorldPointFromClient(svg, event.clientX, event.clientY);
      if (!startWorld || !currentWorld) return;

      const deltaX = currentWorld.x - startWorld.x;
      const deltaY = currentWorld.y - startWorld.y;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        dragState.hasMoved = true;
      }

      setMapCamera(
        clampPlannerCamera(
          {
            ...dragState.startCamera,
            x: dragState.startCamera.x - deltaX,
            y: dragState.startCamera.y - deltaY,
          },
          mapBounds,
        ),
      );
    },
    [mapBounds, updateHoverFromEvent],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const dragState = dragStateRef.current;
      if (dragState && dragState.pointerId === event.pointerId) {
        dragStateRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);

        if (!dragState.hasMoved) {
          const svg = mapSvgRef.current;
          if (!svg) return;
          const worldPoint = getWorldPointFromClient(svg, event.clientX, event.clientY);
          if (!worldPoint) return;
          const target = resolveSettlementPlannerTarget({
            x: worldPoint.x,
            y: worldPoint.y,
            ...plannerData,
          });
          if (target) {
            onSelectTarget(target);
          }
        }
      }
    },
    [onSelectTarget, plannerData],
  );

  const handlePointerLeave = useCallback(() => {
    if (!dragStateRef.current) {
      setHoveredTargetKey(null);
    }
  }, []);

  return (
    <div className={cn("relative rounded-2xl border border-gold/20 bg-[#0c0905]/90 p-3", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gold">Settlement Planner</p>
          <p className="text-[11px] text-gold/60">
            Click a free realm hex or a free village slot. Busy targets stay inspectable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gold/75">
          <span className="rounded-full border border-gold/20 bg-black/30 px-2 py-1">
            {plannerData.realms.length} realms
          </span>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1">
            {freeVillageCount} free village slots
          </span>
          <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-1">
            {freeRealmCount} free realm hexes
          </span>
          <button
            type="button"
            onClick={() => setMapCamera(defaultMapCamera)}
            className="rounded-full border border-gold/20 bg-black/35 px-2 py-1 text-gold/80 transition-colors hover:border-gold/40 hover:text-gold"
          >
            Fit to Map
          </button>
        </div>
      </div>

      <div className={cn("relative overflow-hidden rounded-xl border border-gold/15 bg-[#080603]", mapHeightClassName)}>
        <svg
          ref={mapSvgRef}
          viewBox={viewBox}
          className="h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          <rect
            x={mapBounds.minX}
            y={mapBounds.minY}
            width={mapBounds.width}
            height={mapBounds.height}
            fill="#080603"
          />

          {plannerData.terrainTiles.map((tile) => (
            <polygon
              key={tile.id}
              points={getPlannerHexPoints(tile.pixelX, tile.pixelY)}
              fill={getSettlementPlannerBiomeFill(tile.biome)}
              stroke="rgba(212, 176, 103, 0.12)"
              strokeWidth={0.8}
            />
          ))}

          {plannerData.realmSlots.map((slot) => {
            const targetKey = `realm-slot:${slot.id}`;
            const isSelected = selectedTargetKey === targetKey;
            const isHovered = hoveredTargetKey === targetKey;

            return (
              <polygon
                key={slot.id}
                points={getPlannerHexPoints(slot.pixelX, slot.pixelY)}
                fill={slot.occupied ? "rgba(130, 44, 44, 0.24)" : "rgba(207, 162, 84, 0.16)"}
                stroke={
                  isSelected
                    ? "rgba(244, 212, 132, 0.95)"
                    : isHovered
                      ? "rgba(244, 212, 132, 0.7)"
                      : slot.occupied
                        ? "rgba(160, 79, 79, 0.38)"
                        : "rgba(222, 187, 110, 0.32)"
                }
                strokeWidth={isSelected ? 2 : 1.2}
              />
            );
          })}

          {plannerData.realms.map((realm) => {
            const targetKey = `realm:${realm.id}`;
            const isSelected = selectedTargetKey === targetKey;
            const isHovered = hoveredTargetKey === targetKey;

            return (
              <g key={realm.id}>
                <circle
                  cx={realm.pixelX}
                  cy={realm.pixelY}
                  r={REALM_MARKER_RADIUS + (isSelected ? 5 : isHovered ? 3.5 : 0)}
                  fill={isSelected ? "rgba(244, 212, 132, 0.15)" : "transparent"}
                  stroke={isHovered || isSelected ? "rgba(244, 212, 132, 0.55)" : "transparent"}
                  strokeWidth={1}
                />
                <circle
                  cx={realm.pixelX}
                  cy={realm.pixelY}
                  r={REALM_MARKER_RADIUS}
                  fill={realm.optimistic ? "rgba(222, 187, 110, 0.85)" : "rgba(130, 104, 68, 0.92)"}
                  stroke={realm.optimistic ? "rgba(255, 222, 148, 0.9)" : "rgba(255, 229, 177, 0.5)"}
                  strokeWidth={1.5}
                />
              </g>
            );
          })}

          {plannerData.villageSlots.map((slot) => {
            const targetKey =
              slot.occupied || slot.pending ? `occupied:village_slot:${slot.id}` : `village-slot:${slot.id}`;
            const isSelected = selectedTargetKey === targetKey;
            const isHovered = hoveredTargetKey === targetKey;
            const fill = slot.pending
              ? "rgba(214, 174, 94, 0.45)"
              : slot.occupied
                ? "rgba(154, 64, 64, 0.78)"
                : "rgba(80, 175, 124, 0.88)";

            return (
              <g key={slot.id}>
                <circle
                  cx={slot.pixelX}
                  cy={slot.pixelY}
                  r={VILLAGE_SLOT_RADIUS + (isSelected ? 4 : isHovered ? 2.5 : 0)}
                  fill={isSelected ? "rgba(244, 212, 132, 0.14)" : "transparent"}
                  stroke={isHovered || isSelected ? "rgba(244, 212, 132, 0.48)" : "transparent"}
                  strokeWidth={1}
                />
                <circle
                  cx={slot.pixelX}
                  cy={slot.pixelY}
                  r={VILLAGE_SLOT_RADIUS}
                  fill={fill}
                  stroke={slot.pending ? "rgba(244, 212, 132, 0.7)" : "rgba(255, 255, 255, 0.35)"}
                  strokeDasharray={slot.pending ? "2 2" : undefined}
                  strokeWidth={1.2}
                />
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-gold/10 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 py-2 text-[11px] text-gold/65">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[rgba(80,175,124,0.88)]" />
              Free village slot
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[rgba(154,64,64,0.78)]" />
              Busy village slot
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[rgba(130,104,68,0.92)]" />
              Settled realm
            </span>
          </div>
          {isLoading && <span>Refreshing planner data…</span>}
        </div>
      </div>
    </div>
  );
};
