import { FELT_CENTER } from "@bibliothecadao/types";

export class Position {
  private x: number;
  private y: number;

  private normalized: boolean;

  constructor({ x, y }: { x: number; y: number }) {
    this.x = x;
    this.y = y;
    // if outside of square 1_000_000 x 1_000_000 around the center, it's already normalized
    const squareSize = 1_000_000;
    const halfSquareSize = squareSize / 2;
    this.normalized = Math.abs(x - FELT_CENTER) > halfSquareSize || Math.abs(y - FELT_CENTER) > halfSquareSize;
  }

  public getContract() {
    return {
      x: this.normalized ? this.x + FELT_CENTER : this.x,
      y: this.normalized ? this.y + FELT_CENTER : this.y,
    };
  }

  public getNormalized() {
    return {
      x: this.normalized ? this.x : this.x - FELT_CENTER,
      y: this.normalized ? this.y : this.y - FELT_CENTER,
    };
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
