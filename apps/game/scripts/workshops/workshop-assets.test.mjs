import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { assertIconFill } from "../../../../scripts/icons/normalize.mjs";
import { expect, it } from "vitest";

it("delivers Craft Yard as a textured, grounded production Workshop", async () => {
  const name = "craft-yard";
  const path = fileURLToPath(new URL("../../public/models/new-buildings-opt/workshop.glb", import.meta.url));
  const verifier = fileURLToPath(new URL("../outposts/verify-outpost.mjs", import.meta.url));
  const checked = JSON.parse(execFileSync(process.execPath, [verifier, path], { encoding: "utf8" }));
  expect(checked.path).toBe(path);
  expect(checked.bounds.min[1]).toBeLessThanOrEqual(0);
  expect(checked.bounds.max[1]).toBeGreaterThan(0.75);
  expect(checked.primitives).toBe(1);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
  const document = await io.read(path);
  const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const material = primitive.getMaterial();
  expect(material.getBaseColorTexture()).not.toBeNull();
  expect(material.getNormalTexture()).not.toBeNull();
  expect(material.getBaseColorTexture()).not.toBe(material.getNormalTexture());
  const color = primitive.getAttribute("COLOR_0");
  for (let i = 0; i < color.getCount(); i++) {
    const [r, g, b, a] = color.getElement(i, []);
    expect([r, g, b].every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(a).toBeCloseTo(1, 3);
  }
  const paintedUv = primitive.getAttribute("TEXCOORD_0");
  expect(primitive.getAttribute("TEXCOORD_1")).not.toBeNull();
  for (let i = 0; i < paintedUv.getCount(); i++) {
    const uv = paintedUv.getElement(i, []);
    expect(uv.every((value) => value > 0.015 && value < 0.985)).toBe(true);
  }
  const source = readFileSync(new URL(`../../asset-sources/workshops/${name}.blend`, import.meta.url));
  const provenance = document
    .getRoot()
    .listNodes()
    .find((node) => node.getMesh())
    .getExtras();
  expect(provenance.workshopSourceSha256).toBe(createHash("sha256").update(source).digest("hex"));
  const painting = readFileSync(new URL(`../../asset-sources/workshops/${name}.png`, import.meta.url));
  expect(provenance.workshopConceptSha256).toBe(createHash("sha256").update(painting).digest("hex"));
});

it("keeps the rendered Workshop readable in construction cards", async () => {
  const thumbnail = fileURLToPath(new URL("../../public/images/buildings/construction/workshop.png", import.meta.url));
  expect((await assertIconFill(thumbnail, "Workshop construction card")).fill).toBeGreaterThanOrEqual(0.85);
});
