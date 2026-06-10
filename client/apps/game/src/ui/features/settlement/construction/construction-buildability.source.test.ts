// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("construction buildability resolver wiring", () => {
  it("routes every construction entrypoint through the shared resolver", () => {
    const entrypointPaths = [
      "src/ui/features/settlement/construction/select-preview-building.tsx",
      "src/ui/features/settlement/construction/realm-build-actions.ts",
      "src/three/scenes/context-menu/structure-construction-menu.tsx",
      "src/three/scenes/hexception.tsx",
    ];

    for (const entrypointPath of entrypointPaths) {
      expect(readSource(entrypointPath), entrypointPath).toContain("resolveConstructionBuildability");
    }
  });
});
