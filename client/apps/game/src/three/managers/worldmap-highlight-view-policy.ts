export interface HighlightViewTuning {
  routeOpacity: number;
  endpointOpacity: number;
  frontierOpacity: number;
  routeScale: number;
  endpointScale: number;
  frontierScale: number;
}

export function resolveHighlightViewTuning(cameraView: number): HighlightViewTuning {
  switch (cameraView) {
    case 1:
      return {
        routeOpacity: 0.14,
        endpointOpacity: 0.21,
        frontierOpacity: 0.28,
        routeScale: 0.88,
        endpointScale: 0.52,
        frontierScale: 0.7,
      };
    case 3:
      return {
        routeOpacity: 0.22,
        endpointOpacity: 0.3,
        frontierOpacity: 0.4,
        routeScale: 0.98,
        endpointScale: 0.62,
        frontierScale: 0.84,
      };
    case 2:
    default:
      return {
        routeOpacity: 0.16,
        endpointOpacity: 0.24,
        frontierOpacity: 0.32,
        routeScale: 0.92,
        endpointScale: 0.56,
        frontierScale: 0.74,
      };
  }
}
