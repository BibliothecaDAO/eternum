import type { GroundPoint } from "./map-camera";

/**
 * An order's path as the renderer shows it: four stops on the ground, x then z each, from the army to the hex it is
 * sent to. A path of fewer hexes repeats its ends; a longer one is shown by four of its hexes, evenly taken.
 */
export function orderStops(path: readonly GroundPoint[]): Float32Array {
  if (path.length === 0) return new Float32Array();
  const stops = [0, 1, 2, 3].map((stop) => path[Math.round((stop / 3) * (path.length - 1))]);
  return Float32Array.from(stops.flatMap(({ x, z }) => [x, z]));
}
