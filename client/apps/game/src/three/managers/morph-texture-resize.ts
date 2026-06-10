import { DataTexture, FloatType, RedFormat } from "three";

/**
 * Grow a morph-texture data buffer to a new instance capacity, preserving the
 * existing rows. Each row is `rowWidth` floats (morphTargets + 1 base influence);
 * the texture holds `capacity` rows.
 */
export function growMorphTextureData(
  data: Float32Array,
  rowWidth: number,
  oldCapacity: number,
  newCapacity: number,
): Float32Array {
  const grown = new Float32Array(rowWidth * newCapacity);
  grown.set(data.subarray(0, rowWidth * oldCapacity));
  return grown;
}

interface MorphTextureHolder {
  morphTexture: DataTexture | null;
}

/**
 * Phase 2.3: ensure an InstancedMesh's morph texture can hold `newCapacity` rows.
 *
 * three allocates `morphTexture` lazily at the instance count present on the first
 * `setMorphAt` call (the initial capacity, 64 for armies / 32 for instanced models).
 * Once the global instance slots grow past that, `setMorphAt` and the per-frame
 * morph writes index past the fixed-size Float32Array and throw a RangeError on the
 * frame path. Rebuilding the texture at the larger capacity (copying the existing
 * rows, disposing the old GPU texture) keeps those writes in bounds.
 *
 * Returns true when a resize happened, false when the texture is absent or already
 * large enough.
 */
export function resizeInstancedMorphTexture(mesh: MorphTextureHolder, newCapacity: number): boolean {
  const morphTexture = mesh.morphTexture;
  if (!morphTexture || !morphTexture.image) {
    return false;
  }

  const rowWidth = morphTexture.image.width;
  const oldCapacity = morphTexture.image.height;
  if (oldCapacity >= newCapacity) {
    return false;
  }

  const grownData = growMorphTextureData(
    morphTexture.image.data as unknown as Float32Array,
    rowWidth,
    oldCapacity,
    newCapacity,
  );
  const grownTexture = new DataTexture(grownData, rowWidth, newCapacity, RedFormat, FloatType);
  grownTexture.needsUpdate = true;

  morphTexture.dispose();
  mesh.morphTexture = grownTexture;
  return true;
}
