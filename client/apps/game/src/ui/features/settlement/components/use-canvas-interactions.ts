import { FELT_CENTER as SETTLEMENT_CENTER } from "@/ui/config";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_ZOOM_LEVEL,
  MAX_ZOOM_RANGE,
  MIN_ZOOM_LEVEL,
  MIN_ZOOM_RANGE,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
} from "../constants";
import { MapViewState, SettlementLocation } from "../utils/settlement-types";
import { normalizedToContractCoords } from "../utils/settlement-utils";

interface CanvasInteractionsProps {
  availableLocations: SettlementLocation[];
  settledLocations: SettlementLocation[];
  setSelectedLocation: (location: SettlementLocation | null) => void;
  onSelectLocation: (location: SettlementLocation) => void;
  villageSelect?: boolean;
}

/**
 * Custom hook for handling canvas interactions
 */
export const useCanvasInteractions = ({
  availableLocations,
  settledLocations,
  setSelectedLocation,
  onSelectLocation,
  villageSelect = false,
}: CanvasInteractionsProps) => {
  // Use refs instead of state for hover information and dragging state
  const hoveredLocationRef = useRef<SettlementLocation | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const mouseStartPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Map view state
  const [mapViewState, setMapViewState] = useState<MapViewState>({
    mapCenter: { x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER },
    mapSize: { width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT },
    zoomLevel: 1,
  });

  // Interaction state
  const [customNormalizedCoords, setCustomNormalizedCoords] = useState({ x: 0, y: 0 });

  const mapCenter = mapViewState.mapCenter;
  const mapSize = mapViewState.mapSize;
  const zoomLevel = mapViewState.zoomLevel;

  const setMapCenter = (center: { x: number; y: number }) =>
    setMapViewState((prev) => ({ ...prev, mapCenter: center }));

  // Function to set zoom level and update map size
  const setZoom = useCallback((zoomOut: boolean, delta = 10) => {
    setMapViewState((prev) => {
      // Current range
      const currentRange = prev.mapSize.width;

      // Check zoom limits
      if (!zoomOut && currentRange < MIN_ZOOM_RANGE) return prev;
      if (zoomOut && currentRange > MAX_ZOOM_RANGE) return prev;

      // Calculate new size
      const ratio = MINIMAP_WIDTH / MINIMAP_HEIGHT;
      const deltaX = Math.round(delta * ratio);
      const deltaY = delta;

      // Update zoom level for UI feedback
      const newZoomLevel = zoomOut
        ? Math.max(MIN_ZOOM_LEVEL, prev.zoomLevel - 0.05)
        : Math.min(MAX_ZOOM_LEVEL, prev.zoomLevel + 0.05);

      return {
        ...prev,
        zoomLevel: newZoomLevel,
        mapSize: {
          width: prev.mapSize.width + (zoomOut ? 2 * deltaX : -2 * deltaX),
          height: prev.mapSize.height + (zoomOut ? 2 * deltaY : -2 * deltaY),
        },
      };
    });
  }, []);

  // Function to zoom to a specific level
  const zoomToLevel = useCallback((targetZoomLevel: number) => {
    setMapViewState((prev) => {
      const ratio = MINIMAP_WIDTH / MINIMAP_HEIGHT;

      // Calculate target width based on zoom level (0.5 to 2)
      // 0.5 = zoomed out (MAX_ZOOM_RANGE)
      // 2 = zoomed in (MIN_ZOOM_RANGE)
      const targetWidth = MAX_ZOOM_RANGE - ((targetZoomLevel - 0.5) / 1.5) * (MAX_ZOOM_RANGE - MIN_ZOOM_RANGE);

      // Ensure we stay within bounds
      const newWidth = Math.max(MIN_ZOOM_RANGE, Math.min(MAX_ZOOM_RANGE, targetWidth));
      const newHeight = newWidth / ratio;

      return {
        ...prev,
        zoomLevel: targetZoomLevel,
        mapSize: {
          width: newWidth,
          height: newHeight,
        },
      };
    });
  }, []);

  // Apply zoom level when it changes
  useEffect(() => {
    zoomToLevel(mapViewState.zoomLevel);
  }, [mapViewState.zoomLevel, zoomToLevel]);

  // Center map on custom coordinates and zoom in
  const centerOnCoordinates = useCallback(() => {
    const contractCoords = normalizedToContractCoords(customNormalizedCoords.x, customNormalizedCoords.y);

    // Set map center to the input coordinates
    setMapViewState((prev) => ({
      ...prev,
      mapCenter: contractCoords,
      zoomLevel: 2,
    }));
  }, [customNormalizedCoords]);

  // Reset map to center
  const resetMapCenter = useCallback(() => {
    setMapViewState({
      mapCenter: { x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER },
      mapSize: { width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT },
      zoomLevel: 1,
    });
    setCustomNormalizedCoords({ x: 0, y: 0 });
  }, []);

  // Handle coordinate input changes
  const handleCoordinateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, coord: "x" | "y") => {
    // Allow empty string, negative sign, or valid numbers
    if (e.target.value === "" || e.target.value === "-" || /^-?\d+$/.test(e.target.value)) {
      const value = e.target.value === "" || e.target.value === "-" ? e.target.value : parseInt(e.target.value);
      setCustomNormalizedCoords((prev) => ({
        ...prev,
        [coord]: value,
      }));
    }
  }, []);

  // Function to get current hovered location (for external access if needed)
  const getHoveredLocation = useCallback(() => {
    return hoveredLocationRef.current;
  }, []);

  // Handle canvas click to select a location
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      // Check if this was a drag or a click
      if (mouseStartPositionRef.current) {
        const startX = mouseStartPositionRef.current.x;
        const startY = mouseStartPositionRef.current.y;
        const endX = event.clientX;
        const endY = event.clientY;

        const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

        // If the mouse moved more than a few pixels, consider it a drag, not a click
        if (distance > 5) {
          return;
        }
      }

      const canvas = event.currentTarget;
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

      // Determine which list of locations to iterate over based on villageSelect
      const locationsToCheck = villageSelect ? settledLocations : availableLocations;

      locationsToCheck.forEach((location) => {
        // Skip if outside visible area
        if (location.x < minX || location.x > maxX || location.y < minY || location.y > maxY) return;

        // If not in villageSelect mode, check if this location is already settled and skip if it is
        if (!villageSelect) {
          const isSettled = settledLocations.some(
            (settled) =>
              settled.layer === location.layer && settled.side === location.side && settled.point === location.point,
          );
          // Skip if already settled when not in villageSelect mode
          if (isSettled) return;
        }

        const canvasX = padding + (location.x - minX) * scale;
        const canvasY = padding + (location.y - minY) * scale;

        const distance = Math.sqrt(Math.pow(canvasX - x, 2) + Math.pow(canvasY - y, 2));

        if (distance < minDistance) {
          minDistance = distance;
          closestLocation = location;
        }
      });

      // If we found a close location and it's within a reasonable distance
      // Ensure the selected location fits the mode (settled for villageSelect, unsettled otherwise)
      if (closestLocation && minDistance < 20) {
        const isClosestSettled = settledLocations.some(
          (settled) =>
            settled.layer === closestLocation!.layer &&
            settled.side === closestLocation!.side &&
            settled.point === closestLocation!.point,
        );

        if ((villageSelect && isClosestSettled) || (!villageSelect && !isClosestSettled)) {
          setSelectedLocation(closestLocation);
          onSelectLocation(closestLocation);
        }
      }
    },
    [availableLocations, mapCenter, mapSize, onSelectLocation, setSelectedLocation, settledLocations, villageSelect],
  );

  // Handle mouse move to show hover effect
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Handle dragging
      if (isDraggingRef.current && lastMousePositionRef.current) {
        // Calculate scale to fit visible area on canvas
        const padding = 20;
        const scaleX = (canvas.width - padding * 2) / mapSize.width;
        const scaleY = (canvas.height - padding * 2) / mapSize.height;
        const scale = Math.min(scaleX, scaleY);

        const deltaX = (event.clientX - lastMousePositionRef.current.x) / scale;
        const deltaY = (event.clientY - lastMousePositionRef.current.y) / scale;

        setMapCenter({
          x: mapCenter.x - deltaX,
          y: mapCenter.y - deltaY,
        });

        lastMousePositionRef.current = {
          x: event.clientX,
          y: event.clientY,
        };

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

      // Determine which list of locations to check for hover based on villageSelect
      const locationsForHover = villageSelect ? settledLocations : availableLocations;

      // Filter to only visible locations for better performance
      const visibleLocations = locationsForHover.filter(
        (location) => location.x >= minX && location.x <= maxX && location.y >= minY && location.y <= maxY,
      );

      for (const location of visibleLocations) {
        const canvasX = padding + (location.x - minX) * scale;
        const canvasY = padding + (location.y - minY) * scale;

        const distance = Math.sqrt(Math.pow(canvasX - x, 2) + Math.pow(canvasY - y, 2));

        if (distance < minDistance) {
          minDistance = distance;
          closestLocation = location;
        }
      }

      // If we found a close location and it's within a reasonable distance
      if (closestLocation && minDistance < 20) {
        // Check if this location is already settled
        const isSettled = settledLocations.some(
          (settled) =>
            settled.layer === closestLocation!.layer &&
            settled.side === closestLocation!.side &&
            settled.point === closestLocation!.point,
        );

        // Only hover on locations relevant to the current mode
        // If villageSelect is true, hover on settled locations
        // If villageSelect is false, hover on unsettled locations
        if ((villageSelect && isSettled) || (!villageSelect && !isSettled)) {
          hoveredLocationRef.current = closestLocation;
          canvas.style.cursor = "pointer";

          // Force a redraw of the canvas
          canvas.dispatchEvent(new CustomEvent("needsRedraw"));
        } else {
          // If the closest location is not relevant for the mode, treat it as no hover
          hoveredLocationRef.current = null;
          canvas.style.cursor = isDraggingRef.current ? "grabbing" : "grab";
        }
      } else {
        if (hoveredLocationRef.current !== null) {
          hoveredLocationRef.current = null;
          canvas.style.cursor = isDraggingRef.current ? "grabbing" : "grab";

          // Force a redraw of the canvas
          canvas.dispatchEvent(new CustomEvent("needsRedraw"));
        }
      }
    },
    [availableLocations, isDraggingRef, mapCenter, mapSize, settledLocations, villageSelect],
  );

  // Handle mouse down for dragging
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true;
      lastMousePositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      mouseStartPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      const canvas = event.currentTarget;
      if (canvas) {
        canvas.style.cursor = "grabbing";
      }
    },
    [isDraggingRef],
  );

  // Handle mouse up to end dragging
  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = false;
      lastMousePositionRef.current = null;

      const canvas = event.currentTarget;
      if (canvas) {
        canvas.style.cursor = "grab";
      }

      // Keep track of the end position for click detection
      if (mouseStartPositionRef.current) {
        handleCanvasClick(event);
      }

      mouseStartPositionRef.current = null;
    },
    [handleCanvasClick],
  );

  return {
    handleCanvasClick,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    getHoveredLocation,
    mapCenter,
    mapSize,
    setMapCenter,
    setZoom,
    resetMapCenter,
    handleCoordinateChange,
    customNormalizedCoords,
    centerOnCoordinates,
    zoomLevel,
  };
};
