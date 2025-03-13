import { Position, Position as PositionInterface } from "@/types/position";
import Button from "@/ui/elements/button";
import { ClientComponents, ContractAddress, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo, useRef, useState } from "react";

// Constants for minimap dimensions and settlement configuration
const MINIMAP_WIDTH = 900;
const MINIMAP_HEIGHT = 400;
export const SETTLEMENT_CENTER = 2147483646;
export const SETTLEMENT_BASE_DISTANCE = 30;
export const SETTLEMENT_SUBSEQUENT_DISTANCE = 10;

// Add this near the top of the file with other constants
const BANK_ICON_PATH = `images/resources/${ResourcesIds.Lords}.png`;

// Define the props for the SettlementMinimap component
interface SettlementMinimapProps {
  onSelectLocation: (location: SettlementLocation) => void;
  onConfirm: () => void;
  maxLayers: number;
  // potential player locations to display on the minimap
  extraPlayerOccupiedLocations?: SettlementLocation[];
}

// Settlement location interface
export interface SettlementLocation {
  side: number;
  layer: number;
  point: number;
  x: number;
  y: number;
  isMine?: boolean;
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
  BANK: "#8B6914", // even darker gold color for banks
};

// Legend items mapping
const LEGEND_ITEMS = [
  { color: COLORS.AVAILABLE, label: "Available" },
  { color: COLORS.SELECTED, label: "Selected" },
  { color: COLORS.SETTLED, label: "Settled" },
  { color: COLORS.MINE, label: "Your Realm" },
  { color: COLORS.EXTRA_PLAYER, label: "Your Pending Realms" },
  { color: COLORS.CENTER, label: "Center" },
  { color: COLORS.BANK, label: "Bank" },
];

/**
 * Gets all occupied locations from the game state
 */
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

/**
 * Gets all bank locations from the game state
 */
const getBanksLocations = (components: ClientComponents) => {
  const bankEntities = runQuery([HasValue(components.Structure, { category: StructureType.Bank })]);
  const bankPositions = Array.from(bankEntities).map((entity) => {
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

      return {
        x,
        y,
        side,
        layer,
        point: Math.min(point, layer - 1), // Ensure point doesn't exceed layer-1
      };
    }
    return null;
  });
  return bankPositions.filter((position) => position !== null);
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
  const [bankLocations, setBankLocations] = useState<SettlementLocation[]>([]);

  // Map view state
  const [mapCenter, setMapCenter] = useState({ x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER });
  const [mapSize, setMapSize] = useState({ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [mouseStartPosition, setMouseStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [customNormalizedCoords, setCustomNormalizedCoords] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1); // New state for tracking zoom level

  // Add this with your other state variables
  const [bankIcon, setBankIcon] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    zoomToLevel(zoomLevel);
  }, [zoomLevel]);

  // Add a new state to track animation
  const [animationTime, setAnimationTime] = useState(0);

  const {
    account: { account },
    setup: { components },
  } = useDojo();

  useEffect(() => {
    const bankLocations = getBanksLocations(components);
    setBankLocations(bankLocations);
  }, [components]);

  // Get normalized coordinates for the selected location
  const selectedCoords = useMemo(() => {
    if (!selectedLocation) return null;
    const normalizedCoords = new PositionInterface({
      x: selectedLocation.x,
      y: selectedLocation.y,
    }).getNormalized();
    return normalizedCoords;
  }, [selectedLocation]);

  // Fetch occupied locations when account or components change
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

  // Add this with your other useEffect hooks
  useEffect(() => {
    // Load bank icon
    const img = new Image();
    img.src = BANK_ICON_PATH;
    img.onload = () => setBankIcon(img);
  }, []);

  // Function to set zoom level and update map size
  const setZoom = (zoomOut: boolean, delta = 10) => {
    // Min and max zoom ranges
    const MIN_ZOOM_RANGE = 75;
    const MAX_ZOOM_RANGE = 600;

    // Current range
    const currentRange = mapSize.width;

    // Check zoom limits
    if (!zoomOut && currentRange < MIN_ZOOM_RANGE) return;
    if (zoomOut && currentRange > MAX_ZOOM_RANGE) return;

    // Calculate new size
    const ratio = MINIMAP_WIDTH / MINIMAP_HEIGHT;
    const deltaX = Math.round(delta * ratio);
    const deltaY = delta;

    // Update zoom level for UI feedback
    setZoomLevel((prev) => (zoomOut ? Math.max(0.5, prev - 0.05) : Math.min(2, prev + 0.05)));

    setMapSize({
      width: mapSize.width + (zoomOut ? 2 * deltaX : -2 * deltaX),
      height: mapSize.height + (zoomOut ? 2 * deltaY : -2 * deltaY),
    });
  };

  // Add non-passive wheel event listener for zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (event: WheelEvent) => {
      event.preventDefault();
      // Determine zoom direction
      const zoomOut = event.deltaY > 0;
      setZoom(zoomOut);
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

  // Set up a continuous animation loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp: number;

    const animate = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // Update animation time
      setAnimationTime((prev) => prev + deltaTime);

      // Continue the animation loop
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(animate);

    // Clean up on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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

    // Draw center point
    const centerPos = worldToCanvas(SETTLEMENT_CENTER, SETTLEMENT_CENTER);
    ctx.fillStyle = COLORS.CENTER;
    ctx.beginPath();
    ctx.arc(centerPos.x, centerPos.y, 5, 0, Math.PI * 2);
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
      ctx.arc(worldToCanvas(location.x, location.y).x, worldToCanvas(location.y, location.y).y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Add a subtle glow effect for better visibility
      ctx.fillStyle = `${fillColor}33`; // 20% opacity
      ctx.beginPath();
      ctx.arc(worldToCanvas(location.x, location.y).x, worldToCanvas(location.y, location.y).y, 8, 0, Math.PI * 2);
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
        ctx.arc(
          worldToCanvas(location.x, location.y).x,
          worldToCanvas(location.y, location.y).y,
          pulseSize,
          0,
          Math.PI * 2,
        );
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
        ctx.arc(worldToCanvas(location.x, location.y).x, worldToCanvas(location.y, location.y).y, 7, 0, Math.PI * 2);
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
        ctx.arc(legendX + 15, itemY + legendItemHeight / 2, 5, 0, Math.PI * 2);
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
  ]);

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

    // Zoom in to the coordinates
    setZoomLevel(2);
  };

  // Function to zoom to a specific level
  const zoomToLevel = (targetZoomLevel: number) => {
    const MIN_ZOOM_RANGE = 75;
    const MAX_ZOOM_RANGE = 600;
    const currentRange = mapSize.width;
    const ratio = MINIMAP_WIDTH / MINIMAP_HEIGHT;

    // Calculate target width based on zoom level (0.5 to 2)
    // 0.5 = zoomed out (MAX_ZOOM_RANGE)
    // 2 = zoomed in (MIN_ZOOM_RANGE)
    const targetWidth = MAX_ZOOM_RANGE - ((targetZoomLevel - 0.5) / 1.5) * (MAX_ZOOM_RANGE - MIN_ZOOM_RANGE);

    // Ensure we stay within bounds
    const newWidth = Math.max(MIN_ZOOM_RANGE, Math.min(MAX_ZOOM_RANGE, targetWidth));
    const newHeight = newWidth / ratio;

    // Update map size
    setMapSize({
      width: newWidth,
      height: newHeight,
    });

    // Update zoom level
    setZoomLevel(targetZoomLevel);
  };

  // Reset map to center
  const resetMapCenter = () => {
    setMapCenter({ x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER });
    setMapSize({ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT });
    setCustomNormalizedCoords({ x: 0, y: 0 });
    setZoomLevel(1); // Reset zoom level
  };

  return (
    <div className="flex flex-col items-center h-full">
      <div className="flex flex-col items-center justify-center h-[120px] bg-black/30 rounded-lg border border-gold/30 p-4 mb-4 w-full transition-all duration-300 hover:border-gold/50">
        {selectedLocation ? (
          <div className="text-center w-full">
            <div className="text-xl font-semibold text-gold mb-2 border-b border-gold/20 pb-2">Selected Location</div>
            <div className="grid grid-cols-2 gap-6 text-gold">
              <div className="flex flex-col items-center bg-black/40 p-2 rounded-md hover:bg-black/50 transition-colors duration-200">
                <div className="text-sm text-gold/70">X Coordinate</div>
                <div className="text-2xl font-bold">{selectedCoords?.x}</div>
              </div>
              <div className="flex flex-col items-center bg-black/40 p-2 rounded-md hover:bg-black/50 transition-colors duration-200">
                <div className="text-sm text-gold/70">Y Coordinate</div>
                <div className="text-2xl font-bold">{selectedCoords?.y}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-xl font-semibold text-gold flex items-center">
              <svg
                className="w-6 h-6 mr-2 text-gold/70 animate-pulse"
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
              Click on the map to select a location for your realm
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full mb-2 bg-black/30 rounded-lg border border-gold/30 p-2 transition-all duration-300 hover:border-gold/50">
        <div className="flex items-center flex-wrap gap-2">
          <div className="text-gold">Center on:</div>
          <div className="flex items-center">
            <input
              type="text"
              value={customNormalizedCoords.x}
              onChange={(e) => handleCoordinateChange(e, "x")}
              className="w-24 mr-2 bg-black/50 border border-gold/30 rounded px-2 py-1 text-gold focus:border-gold focus:outline-none transition-colors duration-200"
              placeholder="X"
              aria-label="X coordinate"
            />
            <input
              type="text"
              value={customNormalizedCoords.y}
              onChange={(e) => handleCoordinateChange(e, "y")}
              className="w-24 mr-2 bg-black/50 border border-gold/30 rounded px-2 py-1 text-gold focus:border-gold focus:outline-none transition-colors duration-200"
              placeholder="Y"
              aria-label="Y coordinate"
            />
            <Button
              variant="secondary"
              onClick={centerOnCoordinates}
              className="mr-2 hover:bg-gold/20 transition-colors duration-200"
              aria-label="Go to coordinates"
            >
              Go
            </Button>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={resetMapCenter}
          className="hover:bg-gold/20 transition-colors duration-200"
          aria-label="Reset map view"
        >
          <span className="flex items-center">
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Reset View
          </span>
        </Button>
      </div>

      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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

      <Button
        disabled={!selectedLocation}
        className={`w-full transition-all duration-300 ${selectedLocation ? "animate-pulse" : ""}`}
        variant="primary"
        onClick={onConfirm}
      >
        {selectedLocation ? "Confirm Location" : "Select a Location First"}
      </Button>
    </div>
  );
};

export default SettlementMinimap;
