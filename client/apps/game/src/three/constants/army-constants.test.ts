// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildArmyModelAssetPath } from "./army-constants";
import { ModelType } from "../types/army";

describe("buildArmyModelAssetPath", () => {
  it("uses an absolute models path so nested play routes do not fetch the HTML app shell", () => {
    expect(buildArmyModelAssetPath(ModelType.Knight1)).toBe("/models/units/default_knight_lvl1.glb");
    expect(buildArmyModelAssetPath(ModelType.Paladin1)).toBe("/models/units/default_paladin_lvl1.glb");
  });
});
