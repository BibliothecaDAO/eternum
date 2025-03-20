import { useCallback, useRef } from "react";
import { SettlementLocation } from "./settlement-types";

interface CanvasInteractionsProps {
  availableLocations: SettlementLocation[];
  settledLocations: SettlementLocation[];
  mapCenter: { x: number; y: number };
  mapSize: { width: number; height: number };
  setMapCenter: (center: { x: number; y: number }) => void;
  setSelectedLocation: (location: SettlementLocation | null) => void;
  onSelectLocation: (location: SettlementLocation) => void;
}

/**
 * Custom hook for handling canvas interactions
 */
export const useCanvasInteractions = ({
  availableLocations,
  settledLocations,
  mapCenter,
  mapSize,
  setMapCenter,
  setSelectedLocation,
  onSelectLocation,
}: CanvasInteractionsProps) => {
  // Use refs instead of state for hover information and dragging state
  const hoveredLocationRef = useRef<SettlementLocation | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const mouseStartPositionRef = useRef<{ x: number; y: number } | null>(null);

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
    },
    [availableLocations, mapCenter, mapSize, onSelectLocation, setSelectedLocation, settledLocations],
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

      // Filter to only visible locations for better performance
      const visibleLocations = availableLocations.filter(
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

        // Only hover on unsettled locations
        if (!isSettled) {
          hoveredLocationRef.current = closestLocation;
          canvas.style.cursor = "pointer";

          // Force a redraw of the canvas
          canvas.dispatchEvent(new CustomEvent("needsRedraw"));
        } else {
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
    [availableLocations, isDraggingRef, mapCenter, mapSize, settledLocations],
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
  };
};
