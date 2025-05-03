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
  villageSelect = false,
}: SettlementMinimapProps) => {
  // Use the settlement state hook to manage state
  const settlementState = useSettlementState(maxLayers, extraPlayerOccupiedLocations);

  const {
    // Location state
    selectedLocation,
    setSelectedLocation,
    availableLocations,
    settledLocations,
    bankLocations,
    selectedCoords,

    // Resources state
    bankIcon,
    setBankIcon,
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
    setSelectedLocation,
    onSelectLocation,
    villageSelect,
  });

  return (
    <div className="flex flex-col items-center">
      {/* Info Panel */}
      <SettlementInfoPanel selectedLocation={selectedLocation} selectedCoords={selectedCoords} />

      {/* Controls */}
      <SettlementControls
        customNormalizedCoords={canvasInteractions.customNormalizedCoords}
        onCoordinateChange={canvasInteractions.handleCoordinateChange}
        onCenterCoordinates={canvasInteractions.centerOnCoordinates}
        onResetMapCenter={canvasInteractions.resetMapCenter}
      />

      {/* Canvas */}
      <SettlementCanvas
        maxLayers={maxLayers}
        availableLocations={availableLocations}
        settledLocations={settledLocations}
        bankLocations={bankLocations}
        selectedLocation={selectedLocation}
        getHoveredLocation={canvasInteractions.getHoveredLocation}
        extraPlayerOccupiedLocations={extraPlayerOccupiedLocations}
        mapCenter={canvasInteractions.mapCenter}
        mapSize={canvasInteractions.mapSize}
        zoomLevel={canvasInteractions.zoomLevel}
        bankIcon={bankIcon}
        onMouseDown={canvasInteractions.handleMouseDown}
        onMouseMove={canvasInteractions.handleMouseMove}
        onMouseUp={canvasInteractions.handleMouseUp}
        onMouseLeave={canvasInteractions.handleMouseUp}
        onZoom={canvasInteractions.setZoom}
        villageSelect={villageSelect}
      />

      {/* Confirm Button */}
      <ConfirmButton selectedLocation={selectedLocation} onConfirm={onConfirm} />
    </div>
  );
};
