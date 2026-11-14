/** A number in [0, 1) that is always the same for the same hex: what a scene varies a hex's look by. */
export function hashCoordinates(x: number, y: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash);
}
