interface BiomeRenderOrderMaterial {
  depthWrite: boolean;
  // Optional: a multi-material mesh exposes an array with no userData; guard for it.
  userData?: Record<string, unknown>;
}

interface BiomeRenderOrderDecision {
  renderOrder: number;
  /** True when the caller must set depthWrite=true + alphaTest on this material. */
  applyTransparentDepthWrite: boolean;
}

const BIOME_RENDER_ORDER_STAMP = "biomeRenderOrder";

/**
 * Resolve the draw order for a biome mesh based on its material, idempotently.
 *
 * Phase 5.1: biome materials are shared across scenes (one parsed GLTF feeds both
 * the world map and hexception InstancedBiome wrappers). The original logic derived
 * renderOrder from `material.depthWrite` and then flipped depthWrite to true, so a
 * second pass over the same material would (incorrectly) treat it as opaque and pick
 * a different renderOrder. Stamping the resolved value on the material keeps the draw
 * order consistent for every scene that reuses the shared material.
 *
 * Transparent biome materials (depthWrite=false) render at order 3 and need the
 * depth-write/alpha-test fix applied once; opaque materials render at order 2.
 */
export function resolveBiomeMeshRenderOrder(material: BiomeRenderOrderMaterial): BiomeRenderOrderDecision {
  const userData = material.userData;
  const stamped = userData ? userData[BIOME_RENDER_ORDER_STAMP] : undefined;
  if (typeof stamped === "number") {
    return { renderOrder: stamped, applyTransparentDepthWrite: false };
  }

  const isTransparentDepth = !material.depthWrite;
  const renderOrder = isTransparentDepth ? 3 : 2;
  if (userData) {
    userData[BIOME_RENDER_ORDER_STAMP] = renderOrder;
  }
  return { renderOrder, applyTransparentDepthWrite: isTransparentDepth };
}
