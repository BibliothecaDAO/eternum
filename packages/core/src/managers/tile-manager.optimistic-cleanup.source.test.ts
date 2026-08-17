// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("TileManager provisional construction", () => {
  it("delegates transaction and reconciliation lifetime to the game sync runtime", () => {
    const source = readSource("src/managers/tile-manager.ts");

    expect(source).toContain("createProvisionalIntent");
    expect(source).toContain("trackProvisionalTransaction");
    expect(source).not.toContain("addOverride");
    expect(source).not.toContain("setTimeout");
  });
});
