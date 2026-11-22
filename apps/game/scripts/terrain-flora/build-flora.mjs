import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

import { birch } from "./species/birch.mjs";
import { bloomCoral } from "./species/bloom-coral.mjs";
import { boulder } from "./species/boulder.mjs";
import { broadleaf } from "./species/broadleaf.mjs";
import { cactus } from "./species/cactus.mjs";
import { cycad } from "./species/cycad.mjs";
import { deadTree } from "./species/dead-tree.mjs";
import { driftBanner } from "./species/drift-banner.mjs";
import { fallenLog } from "./species/fallen-log.mjs";
import { fern } from "./species/fern.mjs";
import { frostTuft } from "./species/frost-tuft.mjs";
import { glowcap } from "./species/glowcap.mjs";
import { grassTuft } from "./species/grass-tuft.mjs";
import { hollowFern } from "./species/hollow-fern.mjs";
import { mushroom } from "./species/mushroom.mjs";
import { conifer } from "./species/conifer.mjs";
import { palm } from "./species/palm.mjs";
import { rainforestCanopy } from "./species/rainforest-canopy.mjs";
import { rootArch } from "./species/root-arch.mjs";
import { shrub } from "./species/shrub.mjs";
import { standingStone } from "./species/standing-stone.mjs";
import { wildflower } from "./species/wildflower.mjs";

const SPECIES = [
  broadleaf,
  conifer,
  shrub,
  boulder,
  palm,
  rainforestCanopy,
  birch,
  fern,
  cactus,
  cycad,
  fallenLog,
  deadTree,
  mushroom,
  grassTuft,
  wildflower,
  glowcap,
  rootArch,
  bloomCoral,
  hollowFern,
  standingStone,
  driftBanner,
  frostTuft,
];
const SHIPPED_DIRECTORY = fileURLToPath(new URL("../../public/models/terrain-flora/", import.meta.url));

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};
const outputDirectory = resolve(option("--out") ?? SHIPPED_DIRECTORY);
mkdirSync(outputDirectory, { recursive: true });

const built = [];
for (const species of SPECIES.filter((candidate) => !option("--only") || candidate.id === option("--only"))) {
  const variants = Array.from({ length: species.variants }, (_, seed) => species.build(seed));
  const file = `${species.id}.glb`;
  await writeFloraModel(join(outputDirectory, file), species.id, variants);
  const bytes = readFileSync(join(outputDirectory, file));
  const triangles = variants.map((mesh) => mesh.positions.length / 9);
  const radius = footprintRadius(variants);
  built.push({
    id: species.id,
    file,
    height: species.height,
    radius,
    triangles,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
  console.log(`${species.id}: ${triangles.join(", ")} triangles per variant, ${bytes.byteLength} bytes`);
}
recordInManifest(built);

function recordInManifest(rows) {
  const path = join(outputDirectory, "manifest.json");
  const previous = readManifest(path);
  const species = [...previous.species.filter((row) => !rows.some(({ id }) => id === row.id)), ...rows];
  writeFileSync(
    path,
    `${JSON.stringify({ builder: "scripts/terrain-flora/build-flora.mjs", species: species.toSorted((a, b) => a.id.localeCompare(b.id)) }, null, 2)}\n`,
  );
}

function readManifest(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { species: [] };
    throw error;
  }
}

async function writeFloraModel(path, id, variants) {
  const document = new Document();
  const buffer = document.createBuffer();
  const accessor = (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const material = document.createMaterial(`${id}-flora`).setRoughnessFactor(1).setMetallicFactor(0);
  const scene = document.createScene(id);
  variants.forEach((variant, index) => {
    const primitive = document
      .createPrimitive()
      .setMaterial(material)
      .setAttribute("POSITION", accessor("VEC3", new Float32Array(variant.positions)))
      .setAttribute("NORMAL", accessor("VEC3", new Float32Array(variant.normals)))
      .setAttribute("COLOR_0", accessor("VEC3", new Float32Array(variant.colours)))
      .setAttribute("_WIND_WEIGHT", accessor("SCALAR", new Float32Array(variant.foliage)))
      .setAttribute("_WIND_BEND", accessor("SCALAR", new Float32Array(variant.bend)))
      .setAttribute("_GLOW", accessor("SCALAR", new Float32Array(variant.glow)));
    const name = `${id}-${String.fromCharCode(97 + index)}`;
    const node = document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive));
    scene.addChild(node);
  });
  await MeshoptEncoder.ready;
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  await io.write(path, document);
}

function footprintRadius(variants) {
  let widest = 0;
  for (const { positions } of variants) {
    for (let offset = 0; offset < positions.length; offset += 3) {
      widest = Math.max(widest, Math.hypot(positions[offset], positions[offset + 2]));
    }
  }
  return Math.round(widest * 1000) / 1000;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
