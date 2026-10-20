// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { describe, expect, it } from "vitest";

import { SHIP_WORLD_SCALE } from "../characters/ships/ship-design";
import { ModelType } from "../types/army";
import { ARMY_PLATE_HEIGHT, isShipModel, MODEL_TYPE_TO_FILE } from "./army-constants";

/** How far over an army model's top its token's foot stands at least, and at most over the tallest one. */
const CLEARANCE = 0.15;
const LOOSEST = 0.2;

/** Each army model's top as drawn on its tile: the model's own bounds, a ship's baked to its world scale. */
const armyModelTops = async () => {
  const { createDecoderModule } = createRequire(import.meta.url)("draco3dgltf");
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await createDecoderModule() });
  const tops: { model: string; top: number }[] = [];
  for (const [modelType, file] of Object.entries(MODEL_TYPE_TO_FILE)) {
    const document = await io.readBinary(readFileSync(new URL(`../../../public/models/${file}`, import.meta.url)));
    const top = getBounds(document.getRoot().listScenes()[0]).max[1];
    tops.push({ model: file, top: isShipModel(modelType as ModelType) ? top * SHIP_WORLD_SCALE : top });
  }
  return tops;
};

describe("an army's label point (the owner, 2026-10-20: 'label should be above not on the army')", () => {
  it("stands over every army model's top, and no further over the tallest than it needs", async () => {
    const tops = await armyModelTops();
    expect(tops).toHaveLength(Object.keys(MODEL_TYPE_TO_FILE).length);
    for (const { model, top } of tops)
      expect({ model, clear: ARMY_PLATE_HEIGHT - top >= CLEARANCE }).toEqual({ model, clear: true });
    const tallest = Math.max(...tops.map(({ top }) => top));
    expect(ARMY_PLATE_HEIGHT - tallest).toBeLessThanOrEqual(LOOSEST);
  });
});
