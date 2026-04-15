// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap superseded army removal wiring", () => {
  it("does not use cross-entity supersede deletion during army tile updates", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("resolveSupersededPendingArmyRemoval(");
    expect(source).not.toContain("findSupersededArmyRemoval({");
  });
});
