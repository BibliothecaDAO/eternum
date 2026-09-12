/** A placement keeps its animation phase when visibility slots are compacted or rebuilt. */
export function placedModelPhase(x: number, z: number): number {
  let hash = Math.imul(Math.round(x * 1024), 73856093) ^ Math.imul(Math.round(z * 1024), 19349663);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822519);
  return ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
}

export function placedModelTime(seconds: number, phase: number): number {
  return seconds * (0.9 + phase * 0.2) + phase * 13;
}
