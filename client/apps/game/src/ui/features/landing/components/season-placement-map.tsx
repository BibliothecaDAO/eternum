import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

const SEASON_MAP_HEX_RADIUS = 8;

export interface SeasonPlacementMapSlot {
  id: string;
  side: number;
  layer: number;
  point: number;
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
  occupied: boolean;
}

interface SeasonPlacementMapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface SeasonPlacementMapCamera {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SeasonPlacementMapProps {
  slots: SeasonPlacementMapSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: SeasonPlacementMapSlot) => void;
  settledSlotIds?: ReadonlySet<string>;
  spireSlotIds?: ReadonlySet<string>;
  hyperstructureSlotIds?: ReadonlySet<string>;
  className?: string;
  showLegend?: boolean;
  showStats?: boolean;
  showInstructions?: boolean;
  mapHeightClassName?: string;
  tone?: "emerald" | "gold";
}

const buildSeasonMapHexPoints = (centerX: number, centerY: number): string => {
  const points: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    const x = centerX + SEASON_MAP_HEX_RADIUS * Math.cos(angle);
    const y = centerY + SEASON_MAP_HEX_RADIUS * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
};

const buildSpireMarkerPoints = (x: number, y: number): string =>
  `${x.toFixed(2)},${(y - 5).toFixed(2)} ${(x + 4).toFixed(2)},${(y + 4).toFixed(2)} ${(x - 4).toFixed(2)},${(y + 4).toFixed(2)}`;

const buildHyperstructureMarkerPoints = (x: number, y: number): string =>
  `${x.toFixed(2)},${(y - 4.5).toFixed(2)} ${(x + 4.5).toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${(y + 4.5).toFixed(2)} ${(x - 4.5).toFixed(2)},${y.toFixed(2)}`;

const getSeasonMapBounds = (slots: SeasonPlacementMapSlot[]): SeasonPlacementMapBounds => {
  if (slots.length === 0) {
    return {
      minX: -120,
      maxX: 120,
      minY: -120,
      maxY: 120,
      width: 240,
      height: 240,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const slot of slots) {
    minX = Math.min(minX, slot.pixelX - SEASON_MAP_HEX_RADIUS);
    maxX = Math.max(maxX, slot.pixelX + SEASON_MAP_HEX_RADIUS);
    minY = Math.min(minY, slot.pixelY - SEASON_MAP_HEX_RADIUS);
    maxY = Math.max(maxY, slot.pixelY + SEASON_MAP_HEX_RADIUS);
  }

  const padding = 20;
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

const getSeasonMapPanOverscan = (bounds: SeasonPlacementMapBounds): { x: number; y: number } => ({
  x: Math.max(70, bounds.width * 0.2),
  y: Math.max(70, bounds.height * 0.2),
});

const clampSeasonMapCamera = (
  camera: SeasonPlacementMapCamera,
  bounds: SeasonPlacementMapBounds,
): SeasonPlacementMapCamera => {
  const overscan = getSeasonMapPanOverscan(bounds);
  const minPanX = bounds.minX - overscan.x;
  const maxPanX = bounds.maxX + overscan.x;
  const minPanY = bounds.minY - overscan.y;
  const maxPanY = bounds.maxY + overscan.y;
  const minWidth = Math.max(90, bounds.width * 0.14);
  const minHeight = Math.max(90, bounds.height * 0.14);
  const width = Math.max(minWidth, Math.min(camera.width, bounds.width));
  const height = Math.max(minHeight, Math.min(camera.height, bounds.height));
  const x = Math.max(minPanX, Math.min(camera.x, maxPanX - width));
  const y = Math.max(minPanY, Math.min(camera.y, maxPanY - height));

  return { x, y, width, height };
};

const buildSeasonMapCamera = (
  bounds: SeasonPlacementMapBounds,
  selectedSlot: SeasonPlacementMapSlot | null,
): SeasonPlacementMapCamera => {
  if (!selectedSlot) {
    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
    };
  }

  const focusWidth = Math.max(170, bounds.width * 0.78);
  const focusHeight = Math.max(170, bounds.height * 0.78);
  return clampSeasonMapCamera(
    {
      x: selectedSlot.pixelX - focusWidth / 2,
      y: selectedSlot.pixelY - focusHeight / 2,
      width: focusWidth,
      height: focusHeight,
    },
    bounds,
  );
};

const seasonMapCameraToViewBox = (camera: SeasonPlacementMapCamera): string =>
  `${camera.x} ${camera.y} ${camera.width} ${camera.height}`;

const getSeasonMapWorldPointFromClient = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null => {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pointer = svg.createSVGPoint();
  pointer.x = clientX;
  pointer.y = clientY;
  const world = pointer.matrixTransform(ctm.inverse());
  return { x: world.x, y: world.y };
};

const findClosestSeasonMapSlot = (
  slots: SeasonPlacementMapSlot[],
  x: number,
  y: number,
  ignoreOccupied = true,
): SeasonPlacementMapSlot | null => {
  let closest: SeasonPlacementMapSlot | null = null;
  let closestDistanceSq = Number.POSITIVE_INFINITY;

  for (const slot of slots) {
    if (ignoreOccupied && slot.occupied) continue;
    const dx = slot.pixelX - x;
    const dy = slot.pixelY - y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      closest = slot;
    }
  }

  return closest;
};

export const SeasonPlacementMap = ({
  slots,
  selectedSlotId,
  onSelectSlot,
  settledSlotIds,
  spireSlotIds,
  hyperstructureSlotIds,
  className,
  showLegend = true,
  showStats = true,
  showInstructions = true,
  mapHeightClassName = "h-60",
  tone = "emerald",
}: SeasonPlacementMapProps) => {
  const selectedSlot = useMemo(
    () => slots.find((slot) => (selectedSlotId ? slot.id === selectedSlotId : false)) ?? null,
    [slots, selectedSlotId],
  );
  const mapBounds = useMemo(() => getSeasonMapBounds(slots), [slots]);
  const occupiedSlotCount = useMemo(
    () => slots.reduce((count, slot) => (slot.occupied ? count + 1 : count), 0),
    [slots],
  );
  const settledSlots = useMemo(
    () => (settledSlotIds ? slots.filter((slot) => settledSlotIds.has(slot.id)) : []),
    [slots, settledSlotIds],
  );
  const spireSlots = useMemo(
    () => (spireSlotIds ? slots.filter((slot) => spireSlotIds.has(slot.id)) : []),
    [slots, spireSlotIds],
  );
  const hyperstructureSlots = useMemo(
    () => (hyperstructureSlotIds ? slots.filter((slot) => hyperstructureSlotIds.has(slot.id)) : []),
    [slots, hyperstructureSlotIds],
  );
  const [mapCamera, setMapCamera] = useState<SeasonPlacementMapCamera | null>(null);
  const mapDragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startCamera: SeasonPlacementMapCamera;
    hasMoved: boolean;
  } | null>(null);
  const mapViewBox = useMemo(
    () => seasonMapCameraToViewBox(mapCamera ?? buildSeasonMapCamera(mapBounds, selectedSlot)),
    [mapBounds, mapCamera, selectedSlot],
  );

  const handleSlotSelect = useCallback(
    (slot: SeasonPlacementMapSlot) => {
      if (slot.occupied) return;
      onSelectSlot(slot);
    },
    [onSelectSlot],
  );

  const handleMapWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      if (slots.length === 0) return;
      event.preventDefault();
      const currentCamera = mapCamera ?? buildSeasonMapCamera(mapBounds, selectedSlot);
      const worldPoint = getSeasonMapWorldPointFromClient(event.currentTarget, event.clientX, event.clientY);
      if (!worldPoint) return;
      const cursorRatioX = (worldPoint.x - currentCamera.x) / currentCamera.width;
      const cursorRatioY = (worldPoint.y - currentCamera.y) / currentCamera.height;
      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
      const nextWidth = currentCamera.width * zoomFactor;
      const nextHeight = currentCamera.height * zoomFactor;

      const nextCamera = clampSeasonMapCamera(
        {
          x: worldPoint.x - nextWidth * cursorRatioX,
          y: worldPoint.y - nextHeight * cursorRatioY,
          width: nextWidth,
          height: nextHeight,
        },
        mapBounds,
      );
      setMapCamera(nextCamera);
    },
    [mapBounds, mapCamera, selectedSlot, slots.length],
  );

  const handleMapPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (slots.length === 0) return;
      if (event.button !== 0) return;
      const currentCamera = mapCamera ?? buildSeasonMapCamera(mapBounds, selectedSlot);
      event.currentTarget.setPointerCapture(event.pointerId);
      mapDragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCamera: currentCamera,
        hasMoved: false,
      };
    },
    [mapBounds, mapCamera, selectedSlot, slots.length],
  );

  const handleMapPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = mapDragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const pointerDeltaX = event.clientX - drag.startClientX;
      const pointerDeltaY = event.clientY - drag.startClientY;
      if (!drag.hasMoved && Math.abs(pointerDeltaX) < 4 && Math.abs(pointerDeltaY) < 4) {
        return;
      }
      drag.hasMoved = true;
      const panWidth = Math.max(drag.startCamera.width, mapBounds.width * 0.35);
      const panHeight = Math.max(drag.startCamera.height, mapBounds.height * 0.35);
      const deltaX = (pointerDeltaX / rect.width) * panWidth;
      const deltaY = (pointerDeltaY / rect.height) * panHeight;
      const nextCamera = clampSeasonMapCamera(
        {
          ...drag.startCamera,
          x: drag.startCamera.x - deltaX,
          y: drag.startCamera.y - deltaY,
        },
        mapBounds,
      );
      setMapCamera(nextCamera);
    },
    [mapBounds],
  );

  const handleMapPointerEnd = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = mapDragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (!drag.hasMoved) {
        const worldPoint = getSeasonMapWorldPointFromClient(event.currentTarget, event.clientX, event.clientY);
        if (worldPoint) {
          const nearestSlot = findClosestSeasonMapSlot(slots, worldPoint.x, worldPoint.y, true);
          if (nearestSlot) {
            handleSlotSelect(nearestSlot);
          }
        }
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      mapDragStateRef.current = null;
    },
    [handleSlotSelect, slots],
  );

  const resetMapCamera = useCallback(() => {
    setMapCamera(buildSeasonMapCamera(mapBounds, selectedSlot));
  }, [mapBounds, selectedSlot]);

  const toneClass = tone === "gold" ? "text-gold/70" : "text-emerald-100/70";
  const titleClass = tone === "gold" ? "text-gold/85" : "text-emerald-100/85";
  const subtitleClass = tone === "gold" ? "text-gold/60" : "text-emerald-100/65";
  const frameClass = tone === "gold" ? "border-gold/30 bg-black/45" : "border-emerald-300/25 bg-black/40";
  const unoccupiedFill = tone === "gold" ? "#d6b064" : "#34d399";
  const unoccupiedStroke = tone === "gold" ? "#f5d27a" : "#86efac";
  const neutralBorderClass = tone === "gold" ? "border-gold/20" : "border-white/20";
  const neutralBgClass = tone === "gold" ? "bg-gold/10 hover:bg-gold/20" : "bg-white/5 hover:bg-white/10";
  const neutralTextClass = tone === "gold" ? "text-gold/80" : "text-white/75";

  return (
    <div className={cn("space-y-2", className)}>
      {showInstructions && (
        <>
          <p className={cn("text-xs", titleClass)}>Map slot picker (click a hex to populate side/layer/point)</p>
          <p className={cn("text-[11px]", subtitleClass)}>Scroll to zoom. Drag to pan. Click reset to reframe.</p>
        </>
      )}
      <div className={cn("relative overflow-hidden rounded-lg border", mapHeightClassName, frameClass)}>
        <div
          className="absolute inset-0 bg-[url('/images/covers/blitz/07.png')] bg-cover bg-center opacity-20"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/70" aria-hidden />
        <svg
          viewBox={mapViewBox}
          className="relative z-10 h-full w-full touch-none"
          aria-label="Season placement map"
          onWheel={handleMapWheel}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={handleMapPointerEnd}
          onPointerLeave={handleMapPointerEnd}
        >
          {slots.map((slot) => {
            const isSelected = slot.id === selectedSlotId;
            const isSelectable = !slot.occupied;
            return (
              <g key={slot.id}>
                <polygon
                  points={buildSeasonMapHexPoints(slot.pixelX, slot.pixelY)}
                  fill={isSelected ? "#f4d25a" : slot.occupied ? "#4b5563" : unoccupiedFill}
                  fillOpacity={isSelected ? 0.88 : slot.occupied ? 0.35 : 0.28}
                  stroke={isSelected ? "#fef3c7" : slot.occupied ? "#9ca3af" : unoccupiedStroke}
                  strokeWidth={isSelected ? 1.1 : 0.85}
                  strokeOpacity={isSelected ? 1 : slot.occupied ? 0.42 : 0.72}
                  pointerEvents="none"
                />
                <circle
                  data-slot-id={slot.id}
                  cx={slot.pixelX}
                  cy={slot.pixelY}
                  r={13}
                  fill="rgba(255,255,255,0.001)"
                  pointerEvents="all"
                  className={cn(isSelectable && "cursor-pointer")}
                />
              </g>
            );
          })}

          {settledSlots.map((slot) => (
            <circle
              key={`settled-${slot.id}`}
              cx={slot.pixelX}
              cy={slot.pixelY}
              r={3.1}
              fill="#f5deb3"
              stroke="#fef3c7"
              strokeWidth={0.75}
              opacity={0.95}
              pointerEvents="none"
            />
          ))}

          {spireSlots.map((slot) => (
            <polygon
              key={`spire-${slot.id}`}
              points={buildSpireMarkerPoints(slot.pixelX, slot.pixelY)}
              fill="#67e8f9"
              stroke="#ecfeff"
              strokeWidth={0.65}
              opacity={0.95}
              pointerEvents="none"
            />
          ))}

          {hyperstructureSlots.map((slot) => (
            <polygon
              key={`hyper-${slot.id}`}
              points={buildHyperstructureMarkerPoints(slot.pixelX, slot.pixelY)}
              fill="#c4b5fd"
              stroke="#ede9fe"
              strokeWidth={0.65}
              opacity={0.95}
              pointerEvents="none"
            />
          ))}
        </svg>
      </div>
      {showStats && (
        <div className={cn("flex items-center justify-between text-[11px]", toneClass)}>
          <span>Valid slots: {slots.length}</span>
          <span>Occupied: {occupiedSlotCount}</span>
        </div>
      )}
      {showLegend && (
        <div className={cn("flex flex-wrap items-center gap-2 text-[10px]", toneClass)}>
          {settledSlots.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-[#f5deb3]" />
              Settled realms
            </span>
          )}
          {spireSlots.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1">
              <span className="h-2 w-2 rotate-45 bg-[#67e8f9]" />
              Spires
            </span>
          )}
          {hyperstructureSlots.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1">
              <span className="h-2 w-2 rounded-sm bg-[#c4b5fd]" />
              Hyperstructures
            </span>
          )}
          <button
            type="button"
            onClick={resetMapCamera}
            className={cn("rounded border px-2 py-1 text-[10px]", neutralBorderClass, neutralBgClass, neutralTextClass)}
          >
            Reset View
          </button>
        </div>
      )}
    </div>
  );
};
