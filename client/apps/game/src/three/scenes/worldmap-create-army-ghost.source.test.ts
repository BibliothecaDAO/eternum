// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap create-army ghost wiring", () => {
  it("renders pending explorer creation with a ghost unit instead of a resource icon", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("this.armyManager.getPendingCreateArmyGhostSourceSnapshot");
    expect(source).toContain("this.arrivalGhostManager.upsertLocalArrivalGhost");
    expect(source).not.toContain("create-army-resource-");
    expect(source).not.toContain("ensureInfiniteIconFx(fxType, textureUrl");
  });
});
