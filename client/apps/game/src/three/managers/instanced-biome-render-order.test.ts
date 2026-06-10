import { describe, expect, it } from "vitest";

import { resolveBiomeMeshRenderOrder } from "./instanced-biome-render-order";

describe("resolveBiomeMeshRenderOrder", () => {
  it("assigns renderOrder 3 and a depth-write fix to a transparent (depthWrite=false) material", () => {
    const material = { depthWrite: false, userData: {} as Record<string, unknown> };
    expect(resolveBiomeMeshRenderOrder(material)).toEqual({ renderOrder: 3, applyTransparentDepthWrite: true });
  });

  it("assigns renderOrder 2 to an opaque (depthWrite=true) material", () => {
    const material = { depthWrite: true, userData: {} as Record<string, unknown> };
    expect(resolveBiomeMeshRenderOrder(material)).toEqual({ renderOrder: 2, applyTransparentDepthWrite: false });
  });

  // Phase 5.1: two scenes build InstancedBiomes from one shared material. The first
  // pass flips depthWrite true. The second pass must still derive the SAME renderOrder
  // (3) instead of being re-treated as opaque (2), or the second scene renders the
  // biome at a different draw order.
  it("returns the same renderOrder on the second pass over a shared material whose depthWrite was flipped", () => {
    const material = { depthWrite: false, userData: {} as Record<string, unknown> };
    const first = resolveBiomeMeshRenderOrder(material);

    material.depthWrite = true; // the first InstancedBiome applied the depth-write fix

    const second = resolveBiomeMeshRenderOrder(material);

    expect(second.renderOrder).toBe(first.renderOrder);
    expect(second.applyTransparentDepthWrite).toBe(false);
  });
});
