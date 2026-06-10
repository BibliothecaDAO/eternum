import { describe, expect, it, vi } from "vitest";
import { DataTexture, FloatType, RedFormat } from "three";

import { growMorphTextureData, resizeInstancedMorphTexture } from "./morph-texture-resize";

describe("growMorphTextureData", () => {
  it("preserves existing rows and zero-fills the grown region", () => {
    // 2 rows of width 3: row0 = [1,2,3], row1 = [4,5,6]
    const source = new Float32Array([1, 2, 3, 4, 5, 6]);
    const grown = growMorphTextureData(source, 3, 2, 4);

    expect(grown.length).toBe(12);
    expect(Array.from(grown)).toEqual([1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0]);
  });
});

describe("resizeInstancedMorphTexture", () => {
  // Phase 2.3: army/instanced morph textures are allocated at the initial instance
  // capacity (64 / 32). When the global instance slots grow past that, setMorphAt and
  // the per-frame texture writes index past the fixed-size Float32Array, throwing a
  // RangeError on the frame path. The texture must be rebuilt at the new capacity,
  // preserving the existing rows, before any write past the old capacity.
  it("rebuilds the morph texture at the new capacity, preserving existing rows", () => {
    const morphTexture = new DataTexture(new Float32Array([1, 2, 3, 4, 5, 6]), 3, 2, RedFormat, FloatType);
    const disposeSpy = vi.spyOn(morphTexture, "dispose");
    const mesh = { morphTexture } as { morphTexture: DataTexture | null };

    const resized = resizeInstancedMorphTexture(mesh, 4);

    expect(resized).toBe(true);
    expect(mesh.morphTexture).not.toBe(morphTexture);
    expect(mesh.morphTexture!.image.height).toBe(4);
    expect(mesh.morphTexture!.image.width).toBe(3);
    expect(Array.from(mesh.morphTexture!.image.data as Float32Array)).toEqual([1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0]);
    expect(mesh.morphTexture!.needsUpdate).toBe(true);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the texture already covers the requested capacity", () => {
    const morphTexture = new DataTexture(new Float32Array(3 * 4), 3, 4, RedFormat, FloatType);
    const mesh = { morphTexture } as { morphTexture: DataTexture | null };

    const resized = resizeInstancedMorphTexture(mesh, 4);

    expect(resized).toBe(false);
    expect(mesh.morphTexture).toBe(morphTexture);
  });

  it("does nothing when there is no morph texture", () => {
    const mesh = { morphTexture: null } as { morphTexture: DataTexture | null };
    expect(resizeInstancedMorphTexture(mesh, 128)).toBe(false);
  });
});
