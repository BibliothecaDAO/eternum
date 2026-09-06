import { Vector3, WebGPUCoordinateSystem, type PerspectiveCamera } from "three";

export interface WorldmapCameraGroundBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const FRUSTUM_EDGES = [
  [0, 1],
  [1, 3],
  [3, 2],
  [2, 0],
  [4, 5],
  [5, 7],
  [7, 6],
  [6, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

/** Intersect the actual camera frustum with the ground, including its far clipping plane. */
export function resolveWorldmapCameraGroundBounds(camera: PerspectiveCamera): WorldmapCameraGroundBounds | null {
  camera.updateMatrixWorld(true);
  const nearZ = camera.coordinateSystem === WebGPUCoordinateSystem ? 0 : -1;
  const corners = [nearZ, 1].flatMap((z) =>
    [-1, 1].flatMap((y) => [-1, 1].map((x) => new Vector3(x, y, z).unproject(camera))),
  );
  const intersections: Vector3[] = [];
  for (const [start, end] of FRUSTUM_EDGES) {
    const a = corners[start];
    const b = corners[end];
    if (a.y === 0) intersections.push(a);
    if (a.y * b.y < 0) intersections.push(a.clone().lerp(b, a.y / (a.y - b.y)));
  }
  if (intersections.length === 0) return null;
  return {
    minX: Math.min(...intersections.map((point) => point.x)),
    maxX: Math.max(...intersections.map((point) => point.x)),
    minZ: Math.min(...intersections.map((point) => point.z)),
    maxZ: Math.max(...intersections.map((point) => point.z)),
  };
}
