// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Hexception route targeting", () => {
  it("guards construction in spectator mode and leaves confirmed buildings to reconciliation", () => {
    const source = readSource("src/three/scenes/hexception.tsx");
    const click = source.slice(
      source.indexOf("  protected async onHexagonClick"),
      source.indexOf("  private canAffordPreviewBuilding"),
    );
    const guard = click.indexOf("if (!canConstruct || !account)");
    expect(click).toContain("!!account && !useUIStore.getState().isSpectating && !isExplicitSpectateSession()");
    expect(click).toContain("canConstruct ? LeftView.ConstructionView : LeftView.EntityView");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(click.indexOf("this.tileManager.placeBuilding"));
    expect(click).not.toContain("this.removeBuilding");
    expect(click).not.toContain("this.updateBuildingHighlight");
  });

  it("selects the route’s RECS structure before entering and building the local grid", () => {
    const source = readSource("src/three/scenes/hexception.tsx");
    const setup = source.slice(source.indexOf("  setup() {"), source.indexOf("  onSwitchOff("));
    expect(setup.indexOf("this.selectRouteStructure(contractPosition)")).toBeLessThan(
      setup.indexOf("this.isEntered = true"),
    );
    expect(setup.indexOf("this.isEntered = true")).toBeLessThan(setup.indexOf("this.updateHexceptionGrid"));
    expect(source).toContain("getTileAt(this.dojo.components, DEFAULT_COORD_ALT, position.col, position.row)");
  });

  it("anchors the local-view camera on the center keep tile instead of the outer world route coordinates", () => {
    const source = readSource("src/three/scenes/hexception.tsx");
    const methodStart = source.indexOf("public moveCameraToURLLocation()");
    const nextMethodStart = source.indexOf("updateCastleLevel()", methodStart);

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(nextMethodStart).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, nextMethodStart);

    expect(methodBody).toContain("this.moveCameraToColRow(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], 0);");
    expect(methodBody).not.toContain("this.moveCameraToColRow(10, 10, 0);");
  });
});
