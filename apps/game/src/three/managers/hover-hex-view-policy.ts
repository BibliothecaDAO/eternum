export interface HoverHexViewTuning {
  borderThickness: number;
  innerRingThickness: number;
  scanWidth: number;
  centerAlpha: number;
}

export function resolveHoverHexViewTuning(cameraView: number): HoverHexViewTuning {
  switch (cameraView) {
    case 1:
      return {
        borderThickness: 0.08,
        innerRingThickness: 0.035,
        scanWidth: 0.12,
        centerAlpha: 0.1,
      };
    case 3:
      return {
        borderThickness: 0.11,
        innerRingThickness: 0.05,
        scanWidth: 0.16,
        centerAlpha: 0.14,
      };
    case 2:
    default:
      return {
        borderThickness: 0.09,
        innerRingThickness: 0.04,
        scanWidth: 0.14,
        centerAlpha: 0.12,
      };
  }
}
