import { useCallback } from "react";
import { SettlementLocation } from "./settlement-types";

interface CanvasInteractionsProps {
  availableLocations: SettlementLocation[];
  settledLocations: SettlementLocation[];
  mapCenter: { x: number; y: number };
  mapSize: { width: number; height: number };
  isDragging: boolean;
  lastMousePosition: { x: number; y: number } | null;
  mouseStartPosition: { x: number; y: number } | null;
  setIsDragging: (isDragging: boolean) => void;
  setLastMousePosition: (position: { x: number; y: number } | null) => void;
  setMouseStartPosition: (position: { x: number; y: number } | null) => void;
  setMapCenter: (center: { x: number; y: number }) => void;
  setHoveredLocation: (location: SettlementLocation | null) => void;
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
  isDragging,
  lastMousePosition,
  mouseStartPosition,
  setIsDragging,
  setLastMousePosition,
  setMouseStartPosition,
  setMapCenter,
  setHoveredLocation,
  setSelectedLocation,
  onSelectLocation,
}: CanvasInteractionsProps) => {
  // Handle canvas click to select a location
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
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
    [
      availableLocations,
      mapCenter,
      mapSize,
      mouseStartPosition,
      onSelectLocation,
      setSelectedLocation,
      settledLocations,
    ],
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
    },
    [
      availableLocations,
      isDragging,
      lastMousePosition,
      mapCenter,
      mapSize,
      setHoveredLocation,
      setLastMousePosition,
      setMapCenter,
    ],
  );

  // Handle mouse down for dragging
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDragging(true);
      setLastMousePosition({
        x: event.clientX,
        y: event.clientY,
      });
      setMouseStartPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const canvas = event.currentTarget;
      if (canvas) {
        canvas.style.cursor = "grabbing";
      }
    },
    [setIsDragging, setLastMousePosition, setMouseStartPosition],
  );

  // Handle mouse up to end dragging
  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDragging(false);
      setLastMousePosition(null);

      const canvas = event.currentTarget;
      if (canvas) {
        canvas.style.cursor = "grab";
      }

      // Keep track of the end position for click detection
      if (mouseStartPosition) {
        handleCanvasClick(event);
      }

      setMouseStartPosition(null);
    },
    [handleCanvasClick, mouseStartPosition, setIsDragging, setLastMousePosition, setMouseStartPosition],
  );

  return {
    handleCanvasClick,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
  };
};
