// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { afterEach, expect, it } from "vitest";

import { readHeavierModelOptions, splitTriangles } from "./heavier-models.mjs";

const GENERATOR = fileURLToPath(new URL("./heavier-models.mjs", import.meta.url));
const made = [];
afterEach(() => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** One triangle, its corners at x 0, 2 and 0, with a height attribute in whole numbers. */
function oneTriangle() {
  const document = new Document();
  const buffer = document.createBuffer();
  const accessor = (array, type) => document.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const primitive = document
    .createPrimitive()
    .setIndices(accessor(new Uint16Array([0, 1, 2]), "SCALAR"))
    .setAttribute("POSITION", accessor(new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]), "VEC3"))
    .setAttribute("_HEIGHT", accessor(new Uint16Array([0, 3, 6]), "SCALAR"));
  document.createMesh().addPrimitive(primitive);
  return primitive;
}

it("splits a triangle into four at its edges' midpoints, each attribute the mean of the edge's ends", () => {
  const primitive = oneTriangle();

  expect(splitTriangles(primitive)).toBe(true);
  expect(Array.from(primitive.getIndices().getArray())).toEqual([0, 3, 5, 3, 1, 4, 5, 4, 2, 3, 4, 5]);
  expect(Array.from(primitive.getAttribute("POSITION").getArray()).slice(9)).toEqual([1, 0, 0, 1, 1, 0, 0, 1, 0]);
  // Whole-number attributes stay whole: 0..3 rounds to 2, 3..6 to 5, 6..0 to 3.
  expect(Array.from(primitive.getAttribute("_HEIGHT").getArray())).toEqual([0, 3, 6, 2, 5, 3]);
});

it("refuses a run it cannot describe", () => {
  expect(() => readHeavierModelOptions(["--triangles", "2", "--out", "x", "a.glb"])).toThrow(
    '--triangles takes 1, 4 or 16, not "2"',
  );
  expect(() => readHeavierModelOptions(["--out", "x"])).toThrow("name at least one model below public/models");
  expect(readHeavierModelOptions(["--triangles", "16", "--out", "/x", "realms/city.glb"])).toEqual({
    models: ["realms/city.glb"],
    out: "/x",
    textures: 1,
    triangles: 16,
  });
});

it("writes a game model with four times its triangles at its path below models, still Draco-compressed", async () => {
  const out = mkdtempSync(join(tmpdir(), "heavier-models-test-"));
  made.push(out);

  const { reports } = JSON.parse(
    execFileSync("node", [GENERATOR, "--triangles", "4", "--out", out, "frontier/painted/well.glb"], {
      encoding: "utf8",
    }),
  );

  expect(reports[0].triangles.after).toBe(reports[0].triangles.before * 4);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
  const written = await io.read(join(out, "frontier/painted/well.glb"));
  const triangles = written
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((total, primitive) => total + primitive.getIndices().getCount() / 3, 0);
  expect(triangles).toBe(reports[0].triangles.after);
  expect(
    written
      .getRoot()
      .listExtensionsUsed()
      .map((extension) => extension.extensionName),
  ).toContain("KHR_draco_mesh_compression");
});
