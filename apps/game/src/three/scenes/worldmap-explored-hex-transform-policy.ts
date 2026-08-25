interface ExploredHexTransformInput {
  isFlatMode: boolean;
}

interface ExploredHexTransform {
  rotationY: number;
  yOffset: number;
}

export function resolveExploredHexTransform(input: ExploredHexTransformInput): ExploredHexTransform {
  if (input.isFlatMode) {
    return {
      rotationY: 0,
      yOffset: 0.1,
    };
  }

  return {
    rotationY: 0,
    yOffset: 0.05,
  };
}
