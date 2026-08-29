// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("world spatial projection authority", () => {
  it("installs the projection from base RECS components, never provisional wrappers", () => {
    const source = readFileSync(resolve(currentDir, "game-sync.ts"), "utf8");
    const installStart = source.indexOf("const installActiveWorldSpatialProjection");
    const installEnd = source.indexOf("interface InitialSelectableStructure", installStart);
    const installation = source.slice(installStart, installEnd);

    expect(installation).toContain("setup.network.contractComponents.TileOpt");
    expect(installation).toContain("setup.network.contractComponents.ExplorerTroops");
    expect(installation).not.toContain("setup.components.TileOpt");
    expect(installation).not.toContain("setup.components.ExplorerTroops");
  });
});
