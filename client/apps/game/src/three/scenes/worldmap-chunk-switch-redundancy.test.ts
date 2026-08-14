// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("chunk switch critical path", () => {
  it("has no structure hydration gate after structure truth moves to the projection", () => {
    const preparationSource = readFileSync(
      resolve(process.cwd(), "src/three/scenes/warp-travel-chunk-preparation.ts"),
      "utf8",
    );
    const presentationSource = readFileSync(
      resolve(process.cwd(), "src/three/scenes/worldmap-chunk-presentation.ts"),
      "utf8",
    );

    expect(preparationSource).not.toContain("waitForStructureHydrationIdle");
    expect(preparationSource).not.toContain("requireStructures");
    expect(presentationSource).not.toContain("structureReadyPromise");
    expect(presentationSource).not.toContain("structure_hydration");
  });
});
