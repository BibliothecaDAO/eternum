/** Verify the actual Blender exports, including motion seams and depleted-state ownership. */
import assert from "node:assert/strict";
import { writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

import { MeshoptDecoder } from "meshoptimizer";
import { dequantize } from "@gltf-transform/functions";

await MeshoptDecoder.ready;
const models = new URL("../../public/models/reward-tiles/", import.meta.url);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const reports = [];

const studies = process.argv.includes("--studies") ? ["rift-r1", "rift-r2", "chest-c2", "chest-c3"] : [];
for (const id of studies) {
  const document = await io.read(fileURLToPath(new URL(`${id}.glb`, models)));
  const root = document.getRoot();
  assert.equal(root.listAnimations().length, 1, `${id}: expected one authored motion cycle`);
  const animation = root.listAnimations()[0];
  const channels = animation.listChannels();
  for (const channel of channels) verifyLoop(id, channel);
  const bounds = verifyGeometry(id, root);
  if (id.startsWith("rift")) verifyDepletedState(id, root);
  else verifyChestMotion(id, channels);
  if (id === "rift-r2") verifyGeyserDroplets(root);
  if (id === "chest-c2") verifyArcaneRings(root);
  reports.push({ id, passed: true, animationChannels: channels.length, duration: 8, bounds });
}

for (const [id, authoringId] of [
  ["chest", "chest-c2"],
  ["rift", "rift-r2"],
]) {
  const path = fileURLToPath(new URL(`${id}.glb`, models));
  const document = await io.read(path);
  const root = document.getRoot();
  const extensions = root.listExtensionsUsed().map((extension) => extension.extensionName);
  assert.ok(extensions.includes("EXT_meshopt_compression"), `${id}: missing geometry compression`);
  assert.ok(extensions.includes("KHR_texture_basisu"), `${id}: missing GPU texture compression`);
  const bytes = (await stat(path)).size;
  assert.ok(bytes < 1_200_000, `${id}: compressed asset exceeds its transfer budget`);
  await document.transform(dequantize());
  for (const channel of root.listAnimations()[0].listChannels()) verifyLoop(id, channel);
  const bounds = verifyGeometry(authoringId, root);
  if (id === "chest") {
    verifyChestMotion(id, root.listAnimations()[0].listChannels());
    verifyArcaneRings(root);
  } else {
    verifyDepletedState(id, root);
    verifyGeyserDroplets(root);
  }
  reports.push({ id, passed: true, bytes, extensions, bounds });
}

await writeFile(new URL("verification.json", models), JSON.stringify(reports, null, 2) + "\n");
console.log(JSON.stringify(reports, null, 2));

function verifyLoop(id, channel) {
  const sampler = channel.getSampler();
  const times = sampler.getInput().getArray();
  const output = sampler.getOutput();
  const values = output.getArray();
  const width = output.getElementSize();
  assert.equal(times[0], 0, `${id}: clip must start at zero`);
  assert.equal(times.at(-1), 8, `${id}: clip must span eight seconds`);
  const first = values.slice(0, width);
  const last = values.slice(-width);
  const difference = Math.max(...first.map((value, index) => Math.abs(value - last[index])));
  const negated = Math.max(...first.map((value, index) => Math.abs(value + last[index])));
  const error = channel.getTargetPath() === "rotation" ? Math.min(difference, negated) : difference;
  assert.ok(error < 0.001, `${id}: visible loop seam in ${channel.getTargetNode().getName()}`);
  assert.ok(values.every(Number.isFinite), `${id}: non-finite animation values`);
}

function verifyGeometry(id, root) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const node of root.listNodes()) {
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const position = primitive.getAttribute("POSITION");
      assert.ok(position, `${id}: missing positions`);
      const values = position.getArray();
      assert.ok(values.every(Number.isFinite), `${id}: non-finite mesh positions`);
      for (let offset = 0; offset < values.length; offset += 3) {
        for (let axis = 0; axis < 3; axis++) {
          const value =
            matrix[axis] * values[offset] +
            matrix[4 + axis] * values[offset + 1] +
            matrix[8 + axis] * values[offset + 2] +
            matrix[12 + axis];
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
      }
    }
  }
  const minimumWidth = id === "chest-c2" ? 1.6 : 1.7;
  const minimumDepth = id === "chest-c2" ? 1.6 : 1.97;
  assert.ok(max[0] - min[0] >= minimumWidth && max[0] - min[0] <= 1.76, `${id}: incorrect hex width`);
  assert.ok(max[2] - min[2] >= minimumDepth && max[2] - min[2] <= 2.03, `${id}: incorrect hex depth`);
  return { min, max };
}

function verifyDepletedState(id, root) {
  const effects = root.listNodes().find((node) => node.getName().startsWith("EssenceActive") && !node.getMesh());
  assert.ok(effects, `${id}: missing single essence visibility root`);
  const descendants = new Set();
  effects.traverse((node) => descendants.add(node));
  for (const node of root.listNodes()) {
    const luminous = node
      .getMesh()
      ?.listPrimitives()
      .some((primitive) =>
        primitive
          .getMaterial()
          ?.getEmissiveFactor()
          .some((value) => value > 0),
      );
    assert.ok(!luminous || descendants.has(node), `${id}: light remains outside the depleted-state switch`);
  }
}

function verifyChestMotion(id, channels) {
  const bodyMotion = channels.find(
    (channel) => channel.getTargetNode().getName().startsWith("ChestBody") && channel.getTargetPath() === "translation",
  );
  assert.ok(bodyMotion, `${id}: body does not animate`);
  const values = bodyMotion.getSampler().getOutput().getArray();
  const heights = Array.from({ length: values.length / 3 }, (_, index) => values[index * 3 + 1]);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.07, `${id}: missing float or hop`);
  assert.ok(Math.abs(heights[0] - 0.073) < 0.002, `${id}: feet do not land at the authored surface`);
}

function verifyArcaneRings(root) {
  const palette = root.listMaterials().filter((material) => material.getName().startsWith("Ritual stone"));
  assert.equal(
    new Set(palette.map((material) => JSON.stringify(material.getBaseColorFactor()))).size,
    4,
    "chest-c2: stone palette lost its authored tints",
  );
  for (const index of [0, 1]) {
    const ring = root.listNodes().find((node) => node.getName() === `ArcaneSealRing${index}`);
    assert.ok(ring, `chest-c2: missing independent ring ${index}`);
    const materials = new Set();
    ring.traverse((node) => {
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) materials.add(primitive.getMaterial()?.getName());
    });
    assert.ok(materials.has("Ritual violet"), `chest-c2: ring ${index} lacks luminous inscriptions`);
    assert.ok(materials.has("Ritual stone"), `chest-c2: ring ${index} lacks moving masonry`);
  }
}

function verifyGeyserDroplets(root) {
  const drops = root.listNodes().filter((node) => node.getName().startsWith("Lobed liquid essence droplet"));
  assert.equal(drops.length, 24, "rift-r2: missing geyser spray");
  const widths = [];
  for (const drop of drops) {
    const primitive = drop.getMesh().listPrimitives()[0];
    const position = primitive.getAttribute("POSITION");
    const min = position.getMin([]);
    const max = position.getMax([]);
    const size = drop.getScale().map((scale, axis) => (max[axis] - min[axis]) * scale);
    assert.ok(Math.max(...size) / Math.min(...size) < 3, "rift-r2: droplet is stretched into a sliver");
    assert.ok(primitive.getAttribute("COLOR_0"), "rift-r2: droplet has no baked surface texture");
    widths.push(Math.min(...size));
  }
  assert.ok(Math.max(...widths) / Math.min(...widths) > 3, "rift-r2: spray lacks varied droplet volumes");
}
