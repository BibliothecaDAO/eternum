import { useEffect, useRef } from "react";
import {
  BANK_ICON_PATH,
  COLORS,
  LEGEND_ITEMS,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  PI,
  SETTLEMENT_CENTER,
} from "./settlement-constants";
import { SettlementLocation } from "./settlement-types";
import { layerDistanceFromCenter, sideCoordinate } from "./settlement-utils";

interface SettlementCanvasProps {
  maxLayers: number;
  availableLocations: SettlementLocation[];
  settledLocations: SettlementLocation[];
  bankLocations: SettlementLocation[];
  selectedLocation: SettlementLocation | null;
  hoveredLocation: SettlementLocation | null;
  occupiedLocations: SettlementLocation[];
  extraPlayerOccupiedLocations: SettlementLocation[];
  mapCenter: { x: number; y: number };
  mapSize: { width: number; height: number };
  zoomLevel: number;
  animationTime: number;
  bankIcon: HTMLImageElement | null;
  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onZoom?: (zoomOut: boolean) => void;
}

/**
 * Settlement Canvas component - handles the rendering of the settlement map
 */
export const SettlementCanvas = ({
  maxLayers,
  availableLocations,
  settledLocations,
  bankLocations,
  selectedLocation,
  hoveredLocation,
  occupiedLocations,
  extraPlayerOccupiedLocations,
  mapCenter,
  mapSize,
  zoomLevel,
  animationTime,
  bankIcon,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onZoom,
}: SettlementCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load bank icon
  useEffect(() => {
    if (!bankIcon) {
      const img = new Image();
      img.src = BANK_ICON_PATH;
      img.onload = () => {
        // Force a re-render when the icon loads
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            renderCanvas();
          }
        }
      };
    }
  }, [bankIcon]);

  // Add wheel event listener for zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onZoom) return;

    const handleWheelEvent = (event: WheelEvent) => {
      event.preventDefault();
      // Determine zoom direction
      const zoomOut = event.deltaY > 0;
      onZoom(zoomOut);
    };

    canvas.addEventListener("wheel", handleWheelEvent, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheelEvent);
    };
  }, [onZoom]);

  // Draw the minimap
  const renderCanvas = () => {
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

    // Draw hexagonal grid lines for better orientation
    ctx.strokeStyle = "rgba(119, 103, 86, 0.2)"; // Subtle grid color
    ctx.lineWidth = 0.5;

    // Draw concentric hexagons for each layer
    for (let layer = 1; layer <= maxLayers; layer++) {
      const distanceFromCenter = layerDistanceFromCenter(layer);
      ctx.beginPath();

      for (let side = 0; side < 6; side++) {
        const startCoord = sideCoordinate(side, distanceFromCenter);
        const startPos = worldToCanvas(startCoord.x, startCoord.y);

        if (side === 0) {
          ctx.moveTo(startPos.x, startPos.y);
        } else {
          ctx.lineTo(startPos.x, startPos.y);
        }
      }

      // Close the hexagon
      const firstCoord = sideCoordinate(0, distanceFromCenter);
      const firstPos = worldToCanvas(firstCoord.x, firstCoord.y);
      ctx.lineTo(firstPos.x, firstPos.y);

      ctx.stroke();
    }

    // Draw center point - Fix: Use SETTLEMENT_CENTER instead of mapCenter
    const centerPos = worldToCanvas(SETTLEMENT_CENTER, SETTLEMENT_CENTER);
    ctx.fillStyle = COLORS.CENTER;
    ctx.beginPath();
    ctx.arc(centerPos.x, centerPos.y, 5, 0, PI * 2);
    ctx.fill();

    // Draw bank locations
    bankLocations.forEach((location) => {
      // Skip if outside visible area
      if (location.x < minX || location.x > maxX || location.y < minY || location.y > maxY) return;

      const { x, y } = worldToCanvas(location.x, location.y);
      // Draw bank icon instead of a simple circle - make it bigger
      if (bankIcon) {
        ctx.drawImage(bankIcon, x - 15, y - 15, 30, 30); // Increased from 20x20 to 30x30
      }
    });

    // Draw available locations
    availableLocations.forEach((location) => {
      // Skip if outside visible area
      if (location.x < minX || location.x > maxX || location.y < minY || location.y > maxY) return;

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
          !isExtraPlayerLocation && // Make sure it's not an extra player location
          settled.isMine,
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

      // Draw a slightly larger point for better visibility
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(worldToCanvas(location.x, location.y).x, worldToCanvas(location.y, location.y).y, 4, 0, PI * 2);
      ctx.fill();

      // Add a subtle glow effect for better visibility
      ctx.fillStyle = `${fillColor}33`; // 20% opacity
      ctx.beginPath();
      ctx.arc(worldToCanvas(location.x, location.y).x, worldToCanvas(location.y, location.y).y, 8, 0, PI * 2);
      ctx.fill();

      // Highlight selected location
      if (
        selectedLocation &&
        selectedLocation.side === location.side &&
        selectedLocation.layer === location.layer &&
        selectedLocation.point === location.point
      ) {
        // Pulsing effect for selected location using animationTime instead of Date.now()
        const pulseSize = 6 + Math.sin(animationTime / 200) * 2;

        ctx.strokeStyle = COLORS.SELECTED;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(worldToCanvas(location.x, location.y).x, worldToCanvas(location.y, location.y).y, pulseSize, 0, PI * 2);
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
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(worldToCanvas(location.x, location.y).x, worldToCanvas(location.y, location.y).y, 7, 0, PI * 2);
        ctx.stroke();
      }
    });

    // Draw legend
    const legendX = 10;
    const legendY = 10;
    const legendPadding = 10;
    const legendItemHeight = 20;
    const legendWidth = 150;

    // Draw legend background with rounded corners
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    const legendHeight = legendPadding * 2 + legendItemHeight * LEGEND_ITEMS.length;
    const legendRadius = 5;

    ctx.beginPath();
    ctx.moveTo(legendX + legendRadius, legendY);
    ctx.lineTo(legendX + legendWidth - legendRadius, legendY);
    ctx.arcTo(legendX + legendWidth, legendY, legendX + legendWidth, legendY + legendRadius, legendRadius);
    ctx.lineTo(legendX + legendWidth, legendY + legendHeight - legendRadius);
    ctx.arcTo(
      legendX + legendWidth,
      legendY + legendHeight,
      legendX + legendWidth - legendRadius,
      legendY + legendHeight,
      legendRadius,
    );
    ctx.lineTo(legendX + legendRadius, legendY + legendHeight);
    ctx.arcTo(legendX, legendY + legendHeight, legendX, legendY + legendHeight - legendRadius, legendRadius);
    ctx.lineTo(legendX, legendY + legendRadius);
    ctx.arcTo(legendX, legendY, legendX + legendRadius, legendY, legendRadius);
    ctx.fill();

    // Draw legend items
    ctx.font = "12px Arial";
    LEGEND_ITEMS.forEach((item, index) => {
      const itemY = legendY + legendPadding + index * legendItemHeight;

      // Draw color circle or icon
      if (item.color === COLORS.BANK && bankIcon) {
        // Use the bank icon in the legend instead of a diamond shape
        ctx.drawImage(
          bankIcon,
          legendX + 8, // Adjust position as needed
          itemY + legendItemHeight / 2 - 8, // Center vertically
          16, // Width of icon in legend
          16, // Height of icon in legend
        );
      } else {
        // For other items, draw the regular circle
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + 15, itemY + legendItemHeight / 2, 5, 0, PI * 2);
        ctx.fill();
      }

      // Draw label
      ctx.fillStyle = "#FFF5EA";
      ctx.fillText(item.label, legendX + 30, itemY + 14);
    });

    // Draw zoom level indicator
    const zoomIndicatorX = canvas.width - 100;
    const zoomIndicatorY = canvas.height - 30;
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.beginPath();
    ctx.roundRect(zoomIndicatorX, zoomIndicatorY, 90, 20, 5);
    ctx.fill();

    ctx.fillStyle = "#FFF5EA";
    ctx.font = "12px Arial";
    ctx.fillText(`Zoom: ${Math.round(zoomLevel * 100)}%`, zoomIndicatorX + 10, zoomIndicatorY + 14);
  };

  // Re-render canvas when dependencies change
  useEffect(() => {
    renderCanvas();
  }, [
    availableLocations,
    selectedLocation,
    settledLocations,
    hoveredLocation,
    mapCenter,
    mapSize,
    zoomLevel,
    animationTime,
    bankLocations,
    bankIcon,
    maxLayers,
  ]);

  return (
    <div className="relative group">
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        className="border border-gold/50 mb-4 cursor-grab rounded-md shadow-lg hover:border-gold transition-all duration-300"
        aria-label="Settlement map"
      />

      <div className="absolute bottom-2 right-2 text-xs text-gold bg-black/70 p-2 rounded-md opacity-70 group-hover:opacity-100 transition-opacity duration-300 flex items-center">
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
          />
        </svg>
        Scroll to zoom, drag to move
      </div>
    </div>
  );
};
