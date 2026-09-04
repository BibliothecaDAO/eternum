/**
 * Copy one morph-weight row only when its float content changed. Returning the
 * dirty bit lets callers avoid a full DataTexture upload for unchanged rows.
 */
export function writeMorphWeightsIfChanged(
  target: Float32Array,
  targetOffset: number,
  source: Float32Array,
  sourceOffset: number,
  length: number,
): boolean {
  for (let index = 0; index < length; index += 1) {
    if (target[targetOffset + index] !== source[sourceOffset + index]) {
      for (let copyIndex = 0; copyIndex < length; copyIndex += 1) {
        target[targetOffset + copyIndex] = source[sourceOffset + copyIndex];
      }
      return true;
    }
  }

  return false;
}
