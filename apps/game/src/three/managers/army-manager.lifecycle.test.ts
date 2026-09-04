import { describe, expect, it } from "vitest";
import { createArmyManagerLifecycleFixture } from "./army-manager-lifecycle-fixture";

describe("ArmyManager lifecycle", () => {
  it("fully disposes the path renderer during destroy", () => {
    const fixture = createArmyManagerLifecycleFixture();

    fixture.destroy();

    expect(fixture.disposeCalls.pathRenderer).toBe(1);
    expect(fixture.clearAllCalls).toBe(0);
  });

  it("destroys tracked GUI folders during teardown", () => {
    const fixture = createArmyManagerLifecycleFixture();

    fixture.destroy();

    expect(fixture.activeGuiFolders).toBe(0);
  });
});
