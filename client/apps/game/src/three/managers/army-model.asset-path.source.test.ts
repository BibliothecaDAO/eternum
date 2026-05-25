// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("ArmyModel asset path wiring", () => {
  it("loads base army models through the absolute asset-path helper", () => {
    const source = readSource("src/three/managers/army-model.ts");

    expect(source).toContain("buildArmyModelAssetPath");
    expect(source).not.toContain("`models/${fileName}`");
  });
});
