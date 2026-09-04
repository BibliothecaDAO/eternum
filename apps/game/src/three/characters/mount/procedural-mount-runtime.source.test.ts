// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("mounted creature runtime seam", () => {
  it("composes the rider against a mount instead of a concrete horse", () => {
    const source = readFileSync(new URL("../procedural-unit-runtime.ts", import.meta.url), "utf8");

    expect(source).toContain("new ProceduralHorseMountActor(horseRuntime.createActor");
    expect(source).toContain("new ProceduralDragonMountActor(dragonRuntime.createActor");
    expect(source).toContain("createPaladinMount(horseRuntime, dragonRuntime, config)");
    expect(source).toContain("config.dragon.tier === 3");
    expect(source).toContain("private readonly mount: ProceduralMountActor");
    expect(source).not.toContain("private readonly horse: ProceduralHorseActor,\n    private readonly rider");
  });
});
