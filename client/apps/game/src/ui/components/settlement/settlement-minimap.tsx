import { useEffect } from "react";
import { SettlementCanvas } from "./settlement-canvas";
import { BANK_ICON_PATH } from "./settlement-constants";
import { ConfirmButton, SettlementControls, SettlementInfoPanel } from "./settlement-controls";
import { SettlementMinimapProps } from "./settlement-types";
import { useCanvasInteractions } from "./use-canvas-interactions";
import { useSettlementState } from "./use-settlement-state";

/**
 * Settlement Minimap Component
 *
 * This component has been refactored to improve performance and maintainability:
 * 1. State management is handled by the useSettlementState hook
 * 2. Canvas interactions are handled by the useCanvasInteractions hook
 * 3. Rendering is split into smaller, focused components
 * 4. Heavy calculations are memoized and optimized
 */
export const SettlementMinimap = ({
  onSelectLocation,
  onConfirm,
  maxLayers,
  extraPlayerOccupiedLocations = [],
}: SettlementMinimapProps) => {
  // Use the settlement state hook to manage state
  const settlementState = useSettlementState(maxLayers, extraPlayerOccupiedLocations);

  const {
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
    handleCoordinateChange,
    centerOnCoordinates,
    resetMapCenter,
    setZoom,
  } = settlementState;

  // Load bank icon
  useEffect(() => {
    const img = new Image();
    img.src = BANK_ICON_PATH;
    img.onload = () => setBankIcon(img);
  }, [setBankIcon]);

  // Use the canvas interactions hook to handle canvas events
  const canvasInteractions = useCanvasInteractions({
    availableLocations,
    settledLocations,
    mapCenter: mapViewState.mapCenter,
    mapSize: mapViewState.mapSize,
    isDragging,
    lastMousePosition,
    mouseStartPosition,
    setIsDragging,
    setLastMousePosition,
    setMouseStartPosition,
    setMapCenter: (center) => setMapViewState((prev) => ({ ...prev, mapCenter: center })),
    setHoveredLocation,
    setSelectedLocation,
    onSelectLocation,
  });

  return (
    <div className="flex flex-col items-center h-full">
      {/* Info Panel */}
      <SettlementInfoPanel selectedLocation={selectedLocation} selectedCoords={selectedCoords} />

      {/* Controls */}
      <SettlementControls
        customNormalizedCoords={customNormalizedCoords}
        onCoordinateChange={handleCoordinateChange}
        onCenterCoordinates={centerOnCoordinates}
        onResetMapCenter={resetMapCenter}
      />

      {/* Canvas */}
      <SettlementCanvas
        maxLayers={maxLayers}
        availableLocations={availableLocations}
        settledLocations={settledLocations}
        bankLocations={bankLocations}
        selectedLocation={selectedLocation}
        hoveredLocation={hoveredLocation}
        occupiedLocations={occupiedLocations}
        extraPlayerOccupiedLocations={extraPlayerOccupiedLocations}
        mapCenter={mapViewState.mapCenter}
        mapSize={mapViewState.mapSize}
        zoomLevel={mapViewState.zoomLevel}
        animationTime={animationTime}
        bankIcon={bankIcon}
        onMouseDown={canvasInteractions.handleMouseDown}
        onMouseMove={canvasInteractions.handleMouseMove}
        onMouseUp={canvasInteractions.handleMouseUp}
        onMouseLeave={canvasInteractions.handleMouseUp}
        onZoom={setZoom}
      />

      {/* Confirm Button */}
      <ConfirmButton selectedLocation={selectedLocation} onConfirm={onConfirm} />
    </div>
  );
};

export default SettlementMinimap;
