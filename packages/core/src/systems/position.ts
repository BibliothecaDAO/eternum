import { FELT_CENTER } from "../utils/utils";

/**
 * A hex on the world map. The chain's coordinate is the truth; the normalized coordinate is that coordinate minus the
 * map centre, the one the scene, the URL and the tile panel use. A Position is always built from one or the other
 * explicitly: nothing guesses which one a pair of numbers is.
 */
export class Position {
  private constructor(
    private readonly x: number,
    private readonly y: number,
  ) {}

  public static fromContract({ x, y }: { x: number; y: number }): Position {
    return new Position(x, y);
  }

  public static fromNormalized({ x, y }: { x: number; y: number }): Position {
    const center = FELT_CENTER();
    return new Position(x + center, y + center);
  }

  public getContract() {
    return { x: this.x, y: this.y };
  }

  public getNormalized() {
    const center = FELT_CENTER();
    return { x: this.x - center, y: this.y - center };
  }

  public toMapLocationUrl() {
    const normalized = this.getNormalized();
    return `/map?col=${normalized.x}&row=${normalized.y}`;
  }

  public toHexLocationUrl() {
    const normalized = this.getNormalized();
    return `/hex?col=${normalized.x}&row=${normalized.y}`;
  }
}
