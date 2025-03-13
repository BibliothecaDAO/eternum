import { Position, Position as PositionInterface } from "@/types/position";
import Button from "@/ui/elements/button";
import { ClientComponents, ContractAddress, StructureType } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo, useRef, useState } from "react";

const MINIMAP_WIDTH = 900;
const MINIMAP_HEIGHT = 400;

// Define the props for the SettlementMinimap component
interface SettlementMinimapProps {
  onSelectLocation: (location: SettlementLocation) => void;
  onConfirm: () => void;
  maxLayers: number;
  // potential player locations to display on the minimap
  extraPlayerOccupiedLocations?: SettlementLocation[];
}

// Settlement constants
export const SETTLEMENT_CENTER = 2147483646;
export const SETTLEMENT_BASE_DISTANCE = 30;
export const SETTLEMENT_SUBSEQUENT_DISTANCE = 10;

// Settlement location interface
export interface SettlementLocation {
  side: number;
  layer: number;
  point: number;
  x: number;
  y: number;
}
// Colors for different states
const COLORS = {
  AVAILABLE: "#776756", // gray-gold
  SELECTED: "#FFF5EA", // lightest
  HOVERED: "#FAFF00", // yellow
  SETTLED: "#FC4C4C", // red
  MINE: "#B5BD75", // green
  EXTRA_PLAYER: "#6B7FD7", // blueish
  BACKGROUND: "#1B1B1B", // gray
  CENTER: "#FFF5EA", // lightest
};

// Legend items mapping
const LEGEND_ITEMS = [
  { color: COLORS.AVAILABLE, label: "Available" },
  { color: COLORS.SELECTED, label: "Selected" },
  { color: COLORS.SETTLED, label: "Settled" },
  { color: COLORS.MINE, label: "Your Realm" },
  { color: COLORS.EXTRA_PLAYER, label: "Other Player" },
  { color: COLORS.CENTER, label: "Center" },
];

const getOccupiedLocations = (playerAddress: ContractAddress, components: ClientComponents) => {
  const realmEntities = runQuery([HasValue(components.Structure, { category: StructureType.Realm })]);
  const realmPositions = Array.from(realmEntities).map((entity) => {
    const structure = getComponentValue(components.Structure, entity);
    if (structure) {
      const x = structure?.base.coord_x;
      const y = structure?.base.coord_y;

      // Calculate distance from center
      const dx = x - SETTLEMENT_CENTER;
      const dy = y - SETTLEMENT_CENTER;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate layer based on distance
      const layer = Math.round((distance - SETTLEMENT_BASE_DISTANCE) / SETTLEMENT_SUBSEQUENT_DISTANCE) + 1;

      // Calculate angle in radians
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += 2 * Math.PI;

      // Convert angle to side (6 sides, starting from right going counterclockwise)
      const side = Math.floor((angle * 6) / (2 * Math.PI));

      // Calculate point based on position between sides
      const angleInSide = angle - (side * Math.PI) / 3;
      const point = Math.floor((layer * angleInSide) / (Math.PI / 3));

      const isMine = structure?.owner === playerAddress;

      return {
        isMine,
        x,
        y,
        side,
        layer,
        point: Math.min(point, layer - 1), // Ensure point doesn't exceed layer-1
      };
    }
    return null;
  });
  return realmPositions.filter((position) => position !== null);
};

// Settlement minimap component
export const SettlementMinimap = ({
  onSelectLocation,
  onConfirm,
  maxLayers,
  extraPlayerOccupiedLocations = [],
}: SettlementMinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedLocation, setSelectedLocation] = useState<SettlementLocation | null>(null);
  const [availableLocations, setAvailableLocations] = useState<SettlementLocation[]>([]);
  const [settledLocations, setSettledLocations] = useState<SettlementLocation[]>([]);
  const [hoveredLocation, setHoveredLocation] = useState<SettlementLocation | null>(null);

  const [occupiedLocations, setOccupiedLocations] = useState<SettlementLocation[]>([]);

  const {
    account: { account },
    setup: { components },
  } = useDojo();

  useEffect(() => {
    const fetchOccupiedLocations = async () => {
      if (!account?.address) return;
      const locations = [
        ...getOccupiedLocations(ContractAddress(account.address), components),
        ...extraPlayerOccupiedLocations,
      ];
      setOccupiedLocations(locations);
    };
    fetchOccupiedLocations();
  }, [account?.address, components, extraPlayerOccupiedLocations]);

  // Map view state
  const [mapCenter, setMapCenter] = useState({ x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER });
  const [mapSize, setMapSize] = useState({ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [mouseStartPosition, setMouseStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [customNormalizedCoords, setCustomNormalizedCoords] = useState({ x: 0, y: 0 });

  const selectedCoords = useMemo(() => {
    if (!selectedLocation) return null;
    const normalizedCoords = new PositionInterface({
      x: selectedLocation.x,
      y: selectedLocation.y,
    }).getNormalized();
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

  // Helper functions for generating settlement locations
  const layerDistanceFromCenter = (layer: number) => {
    return SETTLEMENT_BASE_DISTANCE + (layer - 1) * SETTLEMENT_SUBSEQUENT_DISTANCE;
  };

  const maxSidePoints = (side: number, layer: number) => {
    if (side > 0) {
      return layer;
    } else {
      return layer - 1;
    }
  };

  const getPosPercentage = (pointOnSide: number, maxPointsOnSide: number) => {
    return (pointOnSide + 1) / (maxPointsOnSide + 1);
  };

  const sideCoordinate = (side: number, distanceFromCenter: number) => {
    const angle = (side * Math.PI) / 3;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const x = SETTLEMENT_CENTER + distanceFromCenter * cos;
    const y = SETTLEMENT_CENTER + distanceFromCenter * sin;

    return { x, y };
  };

  /**
   * Generates all possible settlement locations based on the settlement config
   * @param maxLayers Maximum number of layers to generate
   * @returns Array of all possible settlement locations
   */
  function generateSettlementLocations(maxLayers: number): SettlementLocation[] {
    const locations: SettlementLocation[] = [];

    // Generate locations for each layer, side, and point
    for (let layer = 1; layer <= maxLayers; layer++) {
      const distanceFromCenter = layerDistanceFromCenter(layer);

      for (let side = 0; side < 6; side++) {
        // Calculate max points on this side
        const maxPoints = maxSidePoints(side, layer);

        for (let point = 0; point < maxPoints; point++) {
          // Calculate the coordinates based on the settlement config algorithm
          const startCoord = sideCoordinate(side, distanceFromCenter);
          const nextSide = (side + 1) % 6;
          const posPercentage = getPosPercentage(point, maxPoints);
          const endCoord = sideCoordinate(nextSide, distanceFromCenter);

          // Calculate position along the side based on point and ensure it's an integer
          const x = Math.round(startCoord.x + (endCoord.x - startCoord.x) * posPercentage);
          const y = Math.round(startCoord.y + (endCoord.y - startCoord.y) * posPercentage);

          locations.push({
            side,
            layer,
            point,
            x,
            y,
          });
        }
      }
    }

    return locations;
  }

  // Generate all possible settlement locations based on the settlement config
  useEffect(() => {
    const locations = generateSettlementLocations(maxLayers);

    setSettledLocations(occupiedLocations);
    setAvailableLocations(locations);
  }, [maxLayers, occupiedLocations]);

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

      // Check if this is an extra player location
      const isExtraPlayerLocation = extraPlayerOccupiedLocations.some(
        (extra) => extra.layer === location.layer && extra.side === location.side && extra.point === location.point,
      );

      const isMine = occupiedLocations.some(
        (settled) =>
          settled.layer === location.layer &&
          settled.side === location.side &&
          settled.point === location.point &&
          !isExtraPlayerLocation, // Make sure it's not an extra player location
      );

      // Draw location point with appropriate color
      let fillColor = COLORS.AVAILABLE;
      if (isExtraPlayerLocation) {
        fillColor = COLORS.EXTRA_PLAYER;
      } else if (isMine) {
        fillColor = COLORS.MINE;
      } else if (isSettled) {
        fillColor = COLORS.SETTLED;
      }

      ctx.fillStyle = fillColor;
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

    // Draw legend
    const legendX = 10;
    const legendY = 10;
    const legendPadding = 10;
    const legendItemHeight = 20;
    const legendWidth = 150;

    // Draw legend background
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(legendX, legendY, legendWidth, legendPadding * 2 + legendItemHeight * LEGEND_ITEMS.length);

    // Draw legend items
    ctx.font = "12px Arial";
    LEGEND_ITEMS.forEach((item, index) => {
      const itemY = legendY + legendPadding + index * legendItemHeight;

      // Draw color circle
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX + 15, itemY + legendItemHeight / 2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw label
      ctx.fillStyle = "#FFF5EA";
      ctx.fillText(item.label, legendX + 30, itemY + 14);
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

  // Handle custom coordinate input changes
  const handleCoordinateChange = (e: React.ChangeEvent<HTMLInputElement>, coord: "x" | "y") => {
    // Allow empty string, negative sign, or valid numbers
    if (e.target.value === "" || e.target.value === "-" || /^-?\d+$/.test(e.target.value)) {
      const value = e.target.value === "" || e.target.value === "-" ? e.target.value : parseInt(e.target.value);
      setCustomNormalizedCoords((prev) => ({
        ...prev,
        [coord]: value,
      }));
    }
  };

  // Center map on custom coordinates and zoom in
  const centerOnCoordinates = () => {
    // Convert string values to numbers, defaulting to 0 if empty or just a negative sign
    const x =
      typeof customNormalizedCoords.x === "string" &&
      (customNormalizedCoords.x === "" || customNormalizedCoords.x === "-")
        ? 0
        : Number(customNormalizedCoords.x);
    const y =
      typeof customNormalizedCoords.y === "string" &&
      (customNormalizedCoords.y === "" || customNormalizedCoords.y === "-")
        ? 0
        : Number(customNormalizedCoords.y);

    const contractCoords = new Position({ x, y }).getContract();

    // Set map center to the input coordinates
    setMapCenter({
      x: contractCoords.x,
      y: contractCoords.y,
    });

    // Zoom in by simulating multiple wheel events
    // This uses the same zoom mechanism as scrolling
    const MIN_ZOOM_RANGE = 75;
    const currentRange = mapSize.width;

    // Calculate how much to zoom in - aim for about 1/4 of the current view
    const targetWidth = Math.max(currentRange / 4, MIN_ZOOM_RANGE);
    const zoomSteps = Math.floor((currentRange - targetWidth) / 20); // 20 is 2 * deltaX from wheel event

    // Apply zoom steps
    if (zoomSteps > 0) {
      const ratio = MINIMAP_WIDTH / MINIMAP_HEIGHT;
      const newWidth = currentRange - zoomSteps * 20;
      const newHeight = newWidth / ratio;

      setMapSize({
        width: newWidth,
        height: newHeight,
      });
    }
  };

  // Reset map to center
  const resetMapCenter = () => {
    setMapCenter({ x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER });
    setMapSize({ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT });
    setCustomNormalizedCoords({ x: 0, y: 0 });
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

      <div className="flex items-center justify-between w-full mb-2 bg-black/30 rounded-lg border border-gold/30 p-2">
        <div className="flex items-center">
          <div className="text-gold mr-2">Center on:</div>
          <input
            type="text"
            value={customNormalizedCoords.x}
            onChange={(e) => handleCoordinateChange(e, "x")}
            className="w-24 mr-2 bg-black/50 border border-gold/30 rounded px-2 py-1 text-gold"
            placeholder="X"
          />
          <input
            type="text"
            value={customNormalizedCoords.y}
            onChange={(e) => handleCoordinateChange(e, "y")}
            className="w-24 mr-2 bg-black/50 border border-gold/30 rounded px-2 py-1 text-gold"
            placeholder="Y"
          />
          <Button variant="secondary" onClick={centerOnCoordinates} className="mr-2">
            Go
          </Button>
        </div>
        <Button variant="secondary" onClick={resetMapCenter}>
          Reset View
        </Button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
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
