/**
 * Copy one instance's morph weights into three's instanced morph texture only when their float content changed.
 * Returning the dirty bit lets callers avoid a full DataTexture upload for unchanged rows. Each row holds the base
 * influence and then one weight per target (`InstancedMesh.setMorphAt`); the renderer reads target i from column i + 1.
 */
export function writeMorphWeightsIfChanged(
  target: Float32Array,
  instanceIndex: number,
  rowWidth: number,
  source: Float32Array,
  sourceOffset: number,
  length: number,
): boolean {
  const targetOffset = instanceIndex * rowWidth + 1;
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
