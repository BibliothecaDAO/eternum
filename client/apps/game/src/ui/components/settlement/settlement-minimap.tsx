import { Position as PositionInterface } from "@/types/position";
import Button from "@/ui/elements/button";
import { generateSettlementLocations, SETTLEMENT_CENTER, SettlementLocation } from "@/utils/settlement";
import { useEffect, useMemo, useRef, useState } from "react";

// Define the props for the SettlementMinimap component
interface SettlementMinimapProps {
  onSelectLocation: (location: SettlementLocation) => void;
  onConfirm: () => void;
  maxLayers: number;
}

// Colors for different states
const COLORS = {
  AVAILABLE: "#AAAAAA",
  SELECTED: "#FFFFFF",
  HOVERED: "#FFFF00",
  SETTLED: "#FF0000",
  BACKGROUND: "#111111",
  CENTER: "#FFFFFF",
};

// Dummy list of already settled locations
const SETTLED_LOCATIONS = [
  { layer: 1, side: 0, point: 0 },
  { layer: 1, side: 1, point: 0 },
  { layer: 2, side: 2, point: 1 },
  { layer: 3, side: 3, point: 2 },
  { layer: 2, side: 4, point: 1 },
  { layer: 1, side: 5, point: 0 },
];

// Settlement minimap component
export const SettlementMinimap = ({ onSelectLocation, onConfirm, maxLayers = 5 }: SettlementMinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedLocation, setSelectedLocation] = useState<SettlementLocation | null>(null);
  const [availableLocations, setAvailableLocations] = useState<SettlementLocation[]>([]);
  const [settledLocations, setSettledLocations] = useState<SettlementLocation[]>([]);
  const [hoveredLocation, setHoveredLocation] = useState<SettlementLocation | null>(null);

  // Map view state
  const [mapCenter, setMapCenter] = useState({ x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER });
  const [mapSize, setMapSize] = useState({ width: 200, height: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [mouseStartPosition, setMouseStartPosition] = useState<{ x: number; y: number } | null>(null);

  const selectedCoords = useMemo(() => {
    if (!selectedLocation) return null;
    const normalizedCoords = new PositionInterface({
      x: selectedLocation.x,
      y: selectedLocation.y,
    }).getNormalized();
    console.log({ selectedLocation, normalizedCoords });
    return normalizedCoords;
  }, [selectedLocation]);

  // Add non-passive wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (event: WheelEvent) => {
      event.preventDefault();

      // Determine zoom direction
      const zoomOut = event.deltaY > 0;

      // Min and max zoom ranges
      const MIN_ZOOM_RANGE = 75;
      const MAX_ZOOM_RANGE = 600;

      // Current range
      const currentRange = mapSize.width;

      // Check zoom limits
      if (!zoomOut && currentRange < MIN_ZOOM_RANGE) return;
      if (zoomOut && currentRange > MAX_ZOOM_RANGE) return;

      // Calculate new size
      const ratio = canvas.width / canvas.height;
      const delta = zoomOut ? 10 : -10;
      const deltaX = Math.round(delta * ratio);
      const deltaY = delta;

      setMapSize({
        width: mapSize.width + 2 * deltaX,
        height: mapSize.height + 2 * deltaY,
      });
    };

    canvas.addEventListener("wheel", handleWheelEvent, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheelEvent);
    };
  }, [mapSize]);

  // Generate all possible settlement locations based on the settlement config
  useEffect(() => {
    const locations = generateSettlementLocations(maxLayers);

    // Filter out already settled locations
    const settledCoords = SETTLED_LOCATIONS.map((loc) =>
      locations.find((l) => l.layer === loc.layer && l.side === loc.side && l.point === loc.point),
    ).filter(Boolean) as SettlementLocation[];

    setSettledLocations(settledCoords);
    setAvailableLocations(locations);
  }, [maxLayers]);

  // Draw the minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set background
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate visible area based on map center and size
    const minX = mapCenter.x - mapSize.width / 2;
    const maxX = mapCenter.x + mapSize.width / 2;
    const minY = mapCenter.y - mapSize.height / 2;
    const maxY = mapCenter.y + mapSize.height / 2;

    // Calculate scale to fit visible area on canvas
    const padding = 20;
    const scaleX = (canvas.width - padding * 2) / mapSize.width;
    const scaleY = (canvas.height - padding * 2) / mapSize.height;
    const scale = Math.min(scaleX, scaleY);

    // Function to convert world coordinates to canvas coordinates
    const worldToCanvas = (x: number, y: number) => {
      const canvasX = padding + (x - minX) * scale;
      const canvasY = padding + (y - minY) * scale;
      return { x: canvasX, y: canvasY };
    };

    // Draw center point
    const centerPos = worldToCanvas(SETTLEMENT_CENTER, SETTLEMENT_CENTER);
    ctx.fillStyle = COLORS.CENTER;
    ctx.beginPath();
    ctx.arc(centerPos.x, centerPos.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw available locations
    availableLocations.forEach((location) => {
      // Skip if outside visible area
      if (location.x < minX || location.x > maxX || location.y < minY || location.y > maxY) return;

      // Scale coordinates to canvas size
      const pos = worldToCanvas(location.x, location.y);

      // Check if this location is already settled
      const isSettled = settledLocations.some(
        (settled) =>
          settled.layer === location.layer && settled.side === location.side && settled.point === location.point,
      );

      // Draw location point
      ctx.fillStyle = isSettled ? COLORS.SETTLED : COLORS.AVAILABLE;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Highlight selected location
      if (
        selectedLocation &&
        selectedLocation.side === location.side &&
        selectedLocation.layer === location.layer &&
        selectedLocation.point === location.point
      ) {
        ctx.strokeStyle = COLORS.SELECTED;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Draw selection info
        ctx.fillStyle = COLORS.SELECTED;
        ctx.font = "bold 12px Arial";
        ctx.fillText(`Selected: X ${Math.round(location.x)}, Y ${Math.round(location.y)}`, 10, canvas.height - 10);
      }

      // Highlight hovered location
      if (
        hoveredLocation &&
        hoveredLocation.side === location.side &&
        hoveredLocation.layer === location.layer &&
        hoveredLocation.point === location.point &&
        !isSettled // Only highlight if not settled
      ) {
        ctx.strokeStyle = COLORS.HOVERED;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw settled locations with a different style
    settledLocations.forEach((location) => {
      // Skip if outside visible area
      if (location.x < minX || location.x > maxX || location.y < minY || location.y > maxY) return;

      const pos = worldToCanvas(location.x, location.y);

      // Draw a red X over settled locations
      ctx.strokeStyle = COLORS.SETTLED;
      ctx.lineWidth = 2;

      // Draw X
      const size = 5;
      ctx.beginPath();
      ctx.moveTo(pos.x - size, pos.y - size);
      ctx.lineTo(pos.x + size, pos.y + size);
      ctx.moveTo(pos.x + size, pos.y - size);
      ctx.lineTo(pos.x - size, pos.y + size);
      ctx.stroke();
    });
  }, [availableLocations, selectedLocation, settledLocations, hoveredLocation, mapCenter, mapSize]);

  // Handle canvas click to select a location
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Check if this was a drag or a click
    if (mouseStartPosition) {
      const startX = mouseStartPosition.x;
      const startY = mouseStartPosition.y;
      const endX = event.clientX;
      const endY = event.clientY;

      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

      // If the mouse moved more than a few pixels, consider it a drag, not a click
      if (distance > 5) {
        return;
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate visible area based on map center and size
    const minX = mapCenter.x - mapSize.width / 2;
    const maxX = mapCenter.x + mapSize.width / 2;
    const minY = mapCenter.y - mapSize.height / 2;
    const maxY = mapCenter.y + mapSize.height / 2;

    // Calculate scale to fit visible area on canvas
    const padding = 20;
    const scaleX = (canvas.width - padding * 2) / mapSize.width;
    const scaleY = (canvas.height - padding * 2) / mapSize.height;
    const scale = Math.min(scaleX, scaleY);

    // Find the closest location
    let closestLocation: SettlementLocation | null = null;
    let minDistance = Infinity;

    availableLocations.forEach((location) => {
      // Skip if outside visible area
      if (location.x < minX || location.x > maxX || location.y < minY || location.y > maxY) return;

      // Check if this location is already settled
      const isSettled = settledLocations.some(
        (settled) =>
          settled.layer === location.layer && settled.side === location.side && settled.point === location.point,
      );

      // Skip if already settled
      if (isSettled) return;

      const canvasX = padding + (location.x - minX) * scale;
      const canvasY = padding + (location.y - minY) * scale;

      const distance = Math.sqrt(Math.pow(canvasX - x, 2) + Math.pow(canvasY - y, 2));

      if (distance < minDistance) {
        minDistance = distance;
        closestLocation = location;
      }
    });

    // If we found a close location and it's within a reasonable distance
    if (closestLocation && minDistance < 20) {
      setSelectedLocation(closestLocation);
      onSelectLocation(closestLocation);
    }
  };

  // Handle mouse move to show hover effect
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Handle dragging
    if (isDragging && lastMousePosition) {
      // Calculate scale to fit visible area on canvas
      const padding = 20;
      const scaleX = (canvas.width - padding * 2) / mapSize.width;
      const scaleY = (canvas.height - padding * 2) / mapSize.height;
      const scale = Math.min(scaleX, scaleY);

      const deltaX = (event.clientX - lastMousePosition.x) / scale;
      const deltaY = (event.clientY - lastMousePosition.y) / scale;

      setMapCenter({
        x: mapCenter.x - deltaX,
        y: mapCenter.y - deltaY,
      });

      setLastMousePosition({
        x: event.clientX,
        y: event.clientY,
      });

      return;
    }

    // Calculate visible area based on map center and size
    const minX = mapCenter.x - mapSize.width / 2;
    const maxX = mapCenter.x + mapSize.width / 2;
    const minY = mapCenter.y - mapSize.height / 2;
    const maxY = mapCenter.y + mapSize.height / 2;

    // Calculate scale to fit visible area on canvas
    const padding = 20;
    const scaleX = (canvas.width - padding * 2) / mapSize.width;
    const scaleY = (canvas.height - padding * 2) / mapSize.height;
    const scale = Math.min(scaleX, scaleY);

    // Find the closest location
    let closestLocation: SettlementLocation | null = null;
    let minDistance = Infinity;

    availableLocations.forEach((location) => {
      // Skip if outside visible area
      if (location.x < minX || location.x > maxX || location.y < minY || location.y > maxY) return;

      const canvasX = padding + (location.x - minX) * scale;
      const canvasY = padding + (location.y - minY) * scale;

      const distance = Math.sqrt(Math.pow(canvasX - x, 2) + Math.pow(canvasY - y, 2));

      if (distance < minDistance) {
        minDistance = distance;
        closestLocation = location;
      }
    });

    // If we found a close location and it's within a reasonable distance
    if (closestLocation && minDistance < 20) {
      setHoveredLocation(closestLocation);
      canvas.style.cursor = "pointer";
    } else {
      setHoveredLocation(null);
      canvas.style.cursor = isDragging ? "grabbing" : "grab";
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setLastMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
    setMouseStartPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "grabbing";
    }
  };

  // Handle mouse up to end dragging
  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    setLastMousePosition(null);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "grab";
    }

    // Keep track of the end position for click detection
    if (mouseStartPosition) {
      handleCanvasClick(event);
    }

    setMouseStartPosition(null);
  };

  return (
    <div className="flex flex-col items-center h-full">
      <div className="flex flex-col items-center justify-center h-[120px] bg-black/30 rounded-lg border border-gold/30 p-4 mb-4 w-full">
        {selectedLocation ? (
          <div className="text-center w-full">
            <div className="text-xl font-semibold text-gold mb-2 border-b border-gold/20 pb-2">Selected Location</div>
            <div className="grid grid-cols-2 gap-6 text-gold">
              <div className="flex flex-col items-center bg-black/40 p-2 rounded-md">
                <div className="text-sm text-gold/70">X Coordinate</div>
                <div className="text-2xl font-bold">{selectedCoords?.x}</div>
              </div>
              <div className="flex flex-col items-center bg-black/40 p-2 rounded-md">
                <div className="text-sm text-gold/70">Y Coordinate</div>
                <div className="text-2xl font-bold">{selectedCoords?.y}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-xl font-semibold text-gold flex items-center">
              <svg
                className="w-6 h-6 mr-2 text-gold/70"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Select a location for your realm
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="border border-gold mb-4 cursor-grab rounded-md"
        />

        <div className="absolute bottom-2 right-2 text-xs text-gold bg-black/50 p-1 rounded">
          Scroll to zoom, drag to move
        </div>
      </div>

      <Button disabled={!selectedLocation} className="w-full" variant="primary" onClick={onConfirm}>
        Confirm Location
      </Button>
    </div>
  );
};

export default SettlementMinimap;
