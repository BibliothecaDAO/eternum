import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const scenePath = resolve(currentDir, "fast-travel.ts");
  return readFileSync(scenePath, "utf8");
}

describe("FastTravelScene lifecycle shell", () => {
  it("extends WarpTravel and routes switch-off through the shared lifecycle", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/extends WarpTravel/);
    expect(source).toMatch(/runWarpTravelSwitchOffLifecycle\(\)/);
  });

  it("routes destroy through switch-off before base teardown", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/public destroy\(\): void \{\s*this\.onSwitchOff\(\);[\s\S]*super\.destroy\(\);/);
  });

  it("defines named fast-travel lifecycle hooks instead of inline adapter lambdas", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/configureFastTravelSetupStart/);
    expect(source).toMatch(/prepareFastTravelInitialSetup/);
    expect(source).toMatch(/attachFastTravelLabelGroupsToScene/);
    expect(source).toMatch(/attachFastTravelManagerLabels/);
    expect(source).toMatch(/refreshFastTravelScene/);
    expect(source).toMatch(/reportFastTravelRefreshError/);
    expect(source).toMatch(/disposeFastTravelStoreSubscriptions/);
    expect(source).toMatch(/detachFastTravelManagerLabels/);
  });

  it("does not hydrate demo armies or spires", () => {
    const source = readFastTravelSource();

    expect(source).not.toMatch(/buildDemoArmies/);
    expect(source).not.toMatch(/buildDemoSpires/);
    expect(source).toMatch(/resolveFastTravelLayerState/);
  });

  it("blocks spire exits into allied world-layer armies before opening the travel modal", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    expect(methodBody).toContain("isOpposingArmy: (targetArmyId) => this.canAttackSpireTraversalArmy");
    expect(methodBody).toContain('if (traversalAction.kind === "blocked")');
    expect(methodBody).toContain('toast.error("Another allied army already occupies the linked world tile.")');
  });

  it("hydrates visible ethereal structures before resolving allied ownership", () => {
    const source = readFastTravelSource();

    expect(source).toContain("collectVisibleFastTravelStructureIds");
    expect(source).toContain("const visibleStructureIds = this.collectVisibleFastTravelStructureIds(chunkPlan);");
    expect(source).toContain(
      "const structureIdsToHydrate = new Set<ID>([...ownerStructureIds, ...visibleStructureIds]);",
    );
    expect(source).toContain("[...structureIdsToHydrate]");
  });
});
