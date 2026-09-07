import type Node from "three/src/nodes/core/Node.js";
import { float, mix, step, vec2 } from "three/tsl";

import { TERRAIN_HEX_HORIZONTAL_SPACING, TERRAIN_HEX_VERTICAL_SPACING } from "./terrain-coordinates";

/** Ground and fog share the exact same hex boundary, including across negative rows and page seams. */
export function terrainHexEdgeDistance(worldXZ: Node<"vec2">): Node<"float"> {
  const local = nearestHexLocalPosition(worldXZ).abs();
  const inradius = TERRAIN_HEX_HORIZONTAL_SPACING / 2;
  return float(inradius).sub(local.x.max(local.dot(vec2(0.5, Math.sqrt(3) / 2))));
}

export function nearestHexLocalPosition(worldXZ: Node<"vec2">): Node<"vec2"> {
  // Two offset rectangular lattices describe the canonical point-up hex centers.
  const period = vec2(TERRAIN_HEX_HORIZONTAL_SPACING, TERRAIN_HEX_VERTICAL_SPACING * 2);
  const even = worldXZ.sub(worldXZ.div(period).add(0.5).floor().mul(period));
  const oddWorld = worldXZ.sub(period.mul(0.5));
  const odd = oddWorld.sub(oddWorld.div(period).add(0.5).floor().mul(period));
  return mix(odd, even, step(even.dot(even), odd.dot(odd)));
}
