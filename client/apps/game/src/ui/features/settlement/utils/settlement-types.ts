// Settlement location interface
export interface SettlementLocation {
  side: number;
  layer: number;
  point: number;
  x: number;
  y: number;
  isMine?: boolean;
}

// Map view state interface
export interface MapViewState {
  mapCenter: { x: number; y: number };
  mapSize: { width: number; height: number };
  zoomLevel: number;
}

// Settlement minimap props interface
export interface SettlementMinimapProps {
  onSelectLocation: (location: SettlementLocation) => void;
  onConfirm: () => void;
  maxLayers: number;
  // potential player locations to display on the minimap
  extraPlayerOccupiedLocations?: SettlementLocation[];
  villageSelect?: boolean;
  showSelectButton?: boolean;
}
