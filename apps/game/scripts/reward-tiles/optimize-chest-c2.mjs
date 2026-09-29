/** Prepare the C2 reward hierarchy, then use the shared Draco/KTX2 delivery pipeline. */
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, resample, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

await optimizeChest();

async function optimizeChest() {
  await MeshoptSimplifier.ready;
  const path = fileURLToPath(new URL("../../public/models/reward-tiles/chest-c2.glb", import.meta.url));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(path);
  const beforeBytes = statSync(path).size;
  const beforeTriangles = countTriangles(document);
  await document.transform(
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002 }),
    resample({ tolerance: 0.000001 }),
    prune(),
  );
  await io.write(path, document);
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("../optimize-structure-models.mjs", import.meta.url)), "reward-tiles/chest-c2.glb"],
    { stdio: "inherit" },
  );
  console.log(
    JSON.stringify({
      beforeBytes,
      afterBytes: statSync(path).size,
      beforeTriangles,
      afterTriangles: countTriangles(document),
    }),
  );
}

function countTriangles(document) {
  return document
    .getRoot()
    .listMeshes()
    .reduce(
      (total, mesh) =>
        total + mesh.listPrimitives().reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0),
      0,
    );
}
