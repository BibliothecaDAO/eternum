// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("structure construction context menu", () => {
  it("uses construction effective balance for build availability", () => {
    const source = readSource("src/three/scenes/context-menu/structure-construction-menu.tsx");

    expect(source).toContain("getEffectiveConstructionBalance");
    expect(source).not.toContain("getBalance(structureEntityId");
  });
});
