import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, resample, simplify, weld, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } from "meshoptimizer";
import { fileURLToPath } from "node:url";
import { stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const directory = new URL("../../public/models/reward-tiles/", import.meta.url);
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const reports = [];
for (const [source, target] of [
  ["chest-c2", "chest"],
  ["rift-r2", "rift"],
]) {
  const input = fileURLToPath(new URL(`${source}.glb`, directory));
  const output = fileURLToPath(new URL(`${target}.glb`, directory));
  const document = await io.read(input);
  const beforeTriangles = countTriangles(document);
  await document.transform(
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.005 }),
    resample(),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  await io.write(output, document);
  const compression = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../compress-models.mjs", import.meta.url)), "--only", `reward-tiles/${target}.glb`],
    { stdio: "inherit" },
  );
  if (compression.status !== 0) throw new Error(`Texture compression failed for ${target}`);
  const compressed = await io.read(output);
  await compressed.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
  await io.write(output, compressed);
  reports.push({
    asset: target,
    beforeBytes: (await stat(input)).size,
    afterBytes: (await stat(output)).size,
    beforeTriangles,
    afterTriangles: countTriangles(document),
  });
}
await writeFile(new URL("optimization.json", directory), JSON.stringify(reports, null, 2) + "\n");
console.log(JSON.stringify(reports, null, 2));

function countTriangles(document) {
  return document
    .getRoot()
    .listMeshes()
    .reduce(
      (total, mesh) =>
        total +
        mesh
          .listPrimitives()
          .reduce(
            (sum, primitive) =>
              sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION").getCount()) / 3,
            0,
          ),
      0,
    );
}
