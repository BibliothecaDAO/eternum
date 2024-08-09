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

  public addRowColToQueryString(row: number, col: number): void {
    this.urlParams.set("row", row.toString());
    this.urlParams.set("col", col.toString());
    window.history.replaceState({}, "", `${window.location.pathname}?${this.urlParams}`);
  }
}
