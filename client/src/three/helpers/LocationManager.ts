export class LocationManager {
  private urlParams: URLSearchParams;

  constructor() {
    this.urlParams = new URLSearchParams(window.location.search);
  }

  public getCol(): number | null {
    return Number(this.urlParams.get("col"));
  }

  public getRow(): number | null {
    return Number(this.urlParams.get("row"));
  }

  // check row and col exist
  public checkRowColExist(): boolean {
    return this.urlParams.has("row") && this.urlParams.has("col");
  }
}
