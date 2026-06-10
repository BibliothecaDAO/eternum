import { resolvePlayRouteWorldPosition } from "@/play/navigation/play-route-target";

export class LocationManager {
  private resolveWorldPosition() {
    return resolvePlayRouteWorldPosition(window.location);
  }

  public getCol(): number | null {
    return this.resolveWorldPosition()?.col ?? null;
  }

  public getRow(): number | null {
    return this.resolveWorldPosition()?.row ?? null;
  }

  public checkRowColExist(): boolean {
    return this.resolveWorldPosition() !== null;
  }
}
