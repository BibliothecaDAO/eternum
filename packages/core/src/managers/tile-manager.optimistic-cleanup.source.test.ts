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

  it("keeps provisional building rows readable and predictions echo-shaped", () => {
    const source = readSource("src/managers/tile-manager.ts");

    // Both building patches carry the key-derived schema fields — an
    // override-only row missing any non-optional field reads as undefined,
    // which made pending buildings invisible to every consumer.
    expect(source.match(/game_id: getGameEntityKeyGameId\(\)/g)).toHaveLength(2);
    expect(source.match(/alt: false/g)).toHaveLength(2);

    // Predictions match only what Cairo echoes: never the client-invented
    // entity_id (Cairo assigns a fresh uuid) and never the full patch; a
    // destroy expects the row deletion itself.
    expect(source).not.toContain("matchPatch: buildingPatch");
    expect(source).toContain("matchPatch: null");
  });
});
