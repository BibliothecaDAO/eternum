export class LocationManager {
  private urlParams: URLSearchParams;

  constructor() {
    this.urlParams = new URLSearchParams(window.location.search);
  }

  private updateUrlParams(): void {
    this.urlParams = new URLSearchParams(window.location.search);
  }

  public getCol(): number {
    this.updateUrlParams();
    return Number(this.urlParams.get("col"));
  }

  public getRow(): number {
    this.updateUrlParams();
    return Number(this.urlParams.get("row"));
  }

  // check row and col exist
  public checkRowColExist(): boolean {
    this.updateUrlParams();
    return this.urlParams.has("row") && this.urlParams.has("col");
  }
}
