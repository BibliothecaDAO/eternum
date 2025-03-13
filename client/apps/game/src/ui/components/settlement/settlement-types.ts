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

// Canvas rendering context interface
export interface CanvasRenderingContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  padding: number;
}

// Settlement minimap props interface
export interface SettlementMinimapProps {
  onSelectLocation: (location: SettlementLocation) => void;
  onConfirm: () => void;
  maxLayers: number;
  // potential player locations to display on the minimap
  extraPlayerOccupiedLocations?: SettlementLocation[];
}
