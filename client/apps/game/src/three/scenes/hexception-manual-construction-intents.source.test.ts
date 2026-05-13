// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Hexception manual construction intents", () => {
  it("keeps manual placement locked per tile instead of per building type", () => {
    const source = readSource("src/three/scenes/hexception.tsx");

    expect(source).toContain("const intent = beginConstructionIntent({");
    expect(source).toContain("enforceBuildingTypeUniqueness: false");
  });
});
