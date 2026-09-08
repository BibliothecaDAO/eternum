import { Mesh, Object3D, Vector3 } from "three";
import { TERRAIN_HEX_HORIZONTAL_SPACING } from "../../terrain/terrain-coordinates";

/** Fit the full silhouette inside the hex's inscribed circle, so turning cannot cross a tile edge. */
export function fitShipToHex(object: Object3D): number {
  object.updateMatrixWorld(true);
  const origin = object.getWorldPosition(new Vector3());
  const point = new Vector3();
  let radius = 0;
  let height = 0;
  object.traverseVisible((child) => {
    if (!(child instanceof Mesh)) return;
    const positions = child.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld).sub(origin);
      radius = Math.max(radius, Math.hypot(point.x, point.z));
      height = Math.max(height, Math.abs(point.y));
    }
  });
  if (!Number.isFinite(radius) || radius <= 0) throw new Error("Ship has no measurable hex footprint");
  // Leave room for hull roll, sail billow and pennant flutter above the static silhouette.
  const motionRadius = radius + height * 0.05 + 0.1;
  const scale = (TERRAIN_HEX_HORIZONTAL_SPACING * 0.5 * 0.9) / motionRadius;
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);
  return scale;
}
