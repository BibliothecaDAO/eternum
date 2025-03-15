import { Position } from "@/types/position";
import { ContractAddress } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MAX_ZOOM_LEVEL,
  MAX_ZOOM_RANGE,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  MIN_ZOOM_LEVEL,
  MIN_ZOOM_RANGE,
  SETTLEMENT_CENTER,
} from "./settlement-constants";
import { MapViewState, SettlementLocation } from "./settlement-types";
import {
  generateSettlementLocations,
  getBanksLocations,
  getOccupiedLocations,
  normalizedToContractCoords,
} from "./settlement-utils";

/**
 * Custom hook for managing settlement state and animation
 */
export const useSettlementState = (maxLayers: number, extraPlayerOccupiedLocations: SettlementLocation[] = []) => {
  // Location state
  const [selectedLocation, setSelectedLocation] = useState<SettlementLocation | null>(null);
  const [availableLocations, setAvailableLocations] = useState<SettlementLocation[]>([]);
  const [settledLocations, setSettledLocations] = useState<SettlementLocation[]>([]);
  const [hoveredLocation, setHoveredLocation] = useState<SettlementLocation | null>(null);
  const [occupiedLocations, setOccupiedLocations] = useState<SettlementLocation[]>([]);
  const [bankLocations, setBankLocations] = useState<SettlementLocation[]>([]);

  // Map view state
  const [mapViewState, setMapViewState] = useState<MapViewState>({
    mapCenter: { x: SETTLEMENT_CENTER, y: SETTLEMENT_CENTER },
    mapSize: { width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT },
    zoomLevel: 1,
  });

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [mouseStartPosition, setMouseStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [customNormalizedCoords, setCustomNormalizedCoords] = useState({ x: 0, y: 0 });

  // Resources state
  const [bankIcon, setBankIcon] = useState<HTMLImageElement | null>(null);
  const [animationTime, setAnimationTime] = useState(0);

  const {
    account: { account },
    setup: { components },
  } = useDojo();

  // Get normalized coordinates for the selected location
  const selectedCoords = useMemo(() => {
    if (!selectedLocation) return null;
    const normalizedCoords = new Position({
      x: selectedLocation.x,
      y: selectedLocation.y,
    }).getNormalized();
    return normalizedCoords;
  }, [selectedLocation]);

  // Fetch bank locations
  useEffect(() => {
    const bankLocations = getBanksLocations(components);
    setBankLocations(bankLocations);
  }, [components]);

  // Fetch occupied locations
  useEffect(() => {
    const fetchOccupiedLocations = async () => {
      if (!account?.address) return;

      // Generate all possible settlement locations
      const [allLocations, allLocationsMap] = generateSettlementLocations(maxLayers);

      console.log({allLocations})
      setSettledLocations(occupiedLocations);
      setAvailableLocations(allLocations);

      // Fetch occupied locations
      const locations = [
        ...getOccupiedLocations(ContractAddress(account.address), components, allLocationsMap),
        ...extraPlayerOccupiedLocations,
      ];
      setOccupiedLocations(locations);
    };
    fetchOccupiedLocations();
  }, [account?.address, components, extraPlayerOccupiedLocations, settledLocations, maxLayers]);

  // Generate all possible settlement locations
  useEffect(() => {
    const [locations, _] = generateSettlementLocations(maxLayers);
    setSettledLocations(occupiedLocations);
    setAvailableLocations(locations);
  }, [maxLayers, occupiedLocations]);

  // Set up animation loop
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

  return {
    // Location state
    selectedLocation,
    setSelectedLocation,
    availableLocations,
    settledLocations,
    hoveredLocation,
    setHoveredLocation,
    occupiedLocations,
    bankLocations,
    selectedCoords,

    // Map view state
    mapViewState,
    setMapViewState,

    // Interaction state
    isDragging,
    setIsDragging,
    lastMousePosition,
    setLastMousePosition,
    mouseStartPosition,
    setMouseStartPosition,
    customNormalizedCoords,

    // Resources state
    bankIcon,
    setBankIcon,
    animationTime,

    // Functions
    setZoom,
    zoomToLevel,
    centerOnCoordinates,
    resetMapCenter,
    handleCoordinateChange,
  };
};
