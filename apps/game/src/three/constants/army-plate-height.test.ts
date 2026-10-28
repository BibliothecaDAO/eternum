// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";
import { describe, expect, it } from "vitest";

import { ARMY_MODEL_TOP as PROBED_ARMY_TOP } from "../../../scripts/client-playtest/plates.mjs";
import { SHIP_WORLD_SCALE } from "../characters/ships/ship-design";
import { ModelType } from "../types/army";
import { getArmyGroundOffset } from "../utils/model-grounding";
import {
  ARMY_MODEL_TOP,
  ARMY_PLATE_HEIGHT,
  isShipModel,
  MODEL_TYPE_TO_FILE,
  T1_KNIGHT_WORLD_SCALE,
} from "./army-constants";

/** How far over every army's drawn top its token's foot stands at least, and at most over the tallest one. */
const CLEARANCE = 0.15;
const LOOSEST = 0.2;

/** A model's meshes as the army model draws them: its raw geometry, without the file's node transforms. */
const rawMeshes = async (io: NodeIO, path: string) => {
  const document = await io.readBinary(readFileSync(new URL(`../../../public/models/${path}`, import.meta.url)));
  return document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .map(
      (primitive) =>
        new Mesh(
          new BufferGeometry().setAttribute(
            "position",
            new Float32BufferAttribute(primitive.getAttribute("POSITION")!.getArray()!, 3),
          ),
        ),
    );
};

const topOf = (meshes: readonly Mesh[]) =>
  Math.max(...meshes.map((mesh) => (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox!.max.y)));

/**
 * Each army's top as players see it on its tile: a land model grounded by its lowest vertex (`getArmyGroundOffset`, as
 * the army model places it), a ship at its waterline and world scale, and the T1 knight as it ships, its articulated
 * model standing at `T1_KNIGHT_WORLD_SCALE`.
 */
const drawnTops = async () => {
  const { createDecoderModule } = createRequire(import.meta.url)("draco3dgltf");
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await createDecoderModule() });
  const tops: { model: string; top: number }[] = [];
  for (const [modelType, file] of Object.entries(MODEL_TYPE_TO_FILE) as [ModelType, string][]) {
    const meshes = await rawMeshes(io, file);
    const top = isShipModel(modelType)
      ? topOf(meshes) * SHIP_WORLD_SCALE
      : topOf(meshes) + getArmyGroundOffset(meshes, modelType);
    tops.push({ model: file, top });
  }
  const knight = await rawMeshes(io, "characters/t1-knight-default/near/skin.glb");
  tops.push({
    model: "t1-knight-default (shipped)",
    top: (topOf(knight) + getArmyGroundOffset(knight)) * T1_KNIGHT_WORLD_SCALE,
  });
  return tops;
};

describe("an army's label point (the owner, 2026-10-20: 'label should be above not on the army')", () => {
  it("stands over every army as drawn, and no further over the tallest than it needs", async () => {
    const tops = await drawnTops();
    expect(tops).toHaveLength(Object.keys(MODEL_TYPE_TO_FILE).length + 1);
    for (const { model, top } of tops)
      expect({ model, clear: ARMY_PLATE_HEIGHT - top >= CLEARANCE }).toEqual({ model, clear: true });
    const tallest = Math.max(...tops.map(({ top }) => top));
    expect(ARMY_PLATE_HEIGHT - tallest).toBeLessThanOrEqual(LOOSEST);
    // The pointer meets an army up to the tallest army as drawn, and the live proof measures its label against it.
    expect(Math.abs(ARMY_MODEL_TOP - tallest)).toBeLessThan(0.01);
    expect(PROBED_ARMY_TOP).toBe(ARMY_MODEL_TOP);
  });
});
