// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap superseded army removal wiring", () => {
  it("delegates supersede decisions to the extracted matcher before deleting", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodStart = source.indexOf("private resolveSupersededPendingArmyRemoval(");

    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 1400);
    expect(methodBody).toContain("findSupersededArmyRemoval({");
    expect(methodBody).toContain("if (supersededEntityId === undefined) {");
    expect(methodBody).toContain("this.deleteArmy(supersededEntityId, { playDefeatFx: false })");
  });
});
