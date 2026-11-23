import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { coatOnFlank, flankProjection, paintCoatImage } from "./creature-coat.mjs";
import { bindSkin, writeCreatureModel } from "./creature-export.mjs";
import { writeStudySheet } from "./creature-preview.mjs";
import { countSurfacePieces, skinVolume } from "./creature-surface.mjs";
import { compileVolume } from "./creature-volume.mjs";
import { arcticFox } from "./species/arctic-fox.mjs";
import { bengalTiger } from "./species/bengal-tiger.mjs";
import { desertScorpion } from "./species/desert-scorpion.mjs";
import { emperorPenguin } from "./species/emperor-penguin.mjs";
import { fireBeetle } from "./species/fire-beetle.mjs";
import { greenSeaTurtle } from "./species/green-sea-turtle.mjs";
import { jackrabbit } from "./species/jackrabbit.mjs";
import { keelBilledToucan } from "./species/keel-billed-toucan.mjs";
import { lanternAnglerfish } from "./species/lantern-anglerfish.mjs";
import { mediterraneanTortoise } from "./species/mediterranean-tortoise.mjs";
import { moose } from "./species/moose.mjs";
import { mountainGoat } from "./species/mountain-goat.mjs";
import { plainsZebra } from "./species/plains-zebra.mjs";
import { redBackedSalamander } from "./species/red-backed-salamander.mjs";
import { redDeer } from "./species/red-deer.mjs";
import { shoreCrab } from "./species/shore-crab.mjs";

const SPECIES = [
  arcticFox,
  bengalTiger,
  desertScorpion,
  emperorPenguin,
  fireBeetle,
  greenSeaTurtle,
  jackrabbit,
  keelBilledToucan,
  lanternAnglerfish,
  mediterraneanTortoise,
  moose,
  mountainGoat,
  plainsZebra,
  redBackedSalamander,
  redDeer,
  shoreCrab,
];
const CELL_SIZE = 0.0125;
const TRIANGLE_BUDGET = 6000;
const SKIN_SOFTNESS = 0.035;
const COAT_SIZE = 480;

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};
const shippedDirectory = fileURLToPath(new URL("../../public/models/biome-creatures/", import.meta.url));
const modelsDirectory = resolve(option("--out") ?? shippedDirectory);
const compressor = fileURLToPath(new URL("../compress-models.mjs", import.meta.url));
const studyDirectory = option("--study");
if (studyDirectory) mkdirSync(studyDirectory, { recursive: true });

const built = [];
for (const species of SPECIES.filter((candidate) => !option("--only") || candidate.id === option("--only"))) {
  const creature = await buildCreature(species);
  const modelPath = join(modelsDirectory, `${species.id}.glb`);
  await writeCreatureModel(modelPath, creature);
  if (creature.coatImage) compressCoat(modelPath);
  if (studyDirectory) await writeStudySheet(join(studyDirectory, `${species.id}.png`), creature);
  built.push({ creature, modelPath });
  console.log(`${species.id}: ${creature.mesh.indices.length / 3} triangles, ${creature.joints.length} joints`);
}
if (modelsDirectory === resolve(shippedDirectory)) recordInManifest(built);

function compressCoat(modelPath) {
  const result = spawnSync(process.execPath, [compressor, "--only", modelPath], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (result.status !== 0) throw new Error(`Could not compress ${modelPath}`);
}

function recordInManifest(models) {
  const manifestPath = join(shippedDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const { creature, modelPath } of models) {
    const bytes = readFileSync(modelPath);
    const row = manifest.creatures.findIndex((entry) => entry.id === creature.id);
    if (row < 0) throw new Error(`The manifest has no row for ${creature.id}`);
    manifest.creatures[row] = {
      id: creature.id,
      profile: creature.profile,
      file: `${creature.id}.glb`,
      triangles: creature.mesh.indices.length / 3,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function buildCreature(species) {
  const { joints, solids } = species.sculpt();
  const volume = compileVolume(solids);
  const triangleBudget = species.triangles ?? TRIANGLE_BUDGET;
  const surface = await skinVolume(volume, { cellSize: CELL_SIZE, triangleBudget });
  requireOneSkin(species.id, surface);
  const jointNames = joints.map((joint) => joint.name);
  const skin = bindSkin(surface.positions, volume, jointNames, SKIN_SOFTNESS);
  const coat = species.markings ? coatOnFlank(species.markings, volume.bounds) : null;
  return {
    id: species.id,
    profile: species.profile,
    roughness: species.roughness,
    joints,
    skin,
    coat,
    coatImage: coat ? await paintCoatImage(coat, COAT_SIZE) : null,
    mesh: {
      ...surface,
      uvs: flankProjection(surface.positions, volume.bounds),
      colours: paintVertices(species, volume, surface, skin, jointNames),
    },
  };
}

function requireOneSkin(id, surface) {
  const pieces = countSurfacePieces(surface.indices, surface.positions.length / 3);
  if (pieces === 1) return;
  throw new Error(`${id} melts into ${pieces} separate pieces: every solid must touch the body it hangs on`);
}

function paintVertices(species, volume, surface, skin, jointNames) {
  const colours = new Float32Array(surface.positions.length);
  for (let vertex = 0; vertex < surface.positions.length / 3; vertex++) {
    const [x, y, z] = surface.positions.subarray(vertex * 3, vertex * 3 + 3);
    const normal = surface.normals.subarray(vertex * 3, vertex * 3 + 3);
    const joint = jointNames[skin.joints[vertex * 4]];
    colours.set(species.paint({ x, y, z, normal, joint, tag: volume.tagAt(x, y, z) }), vertex * 3);
  }
  return colours;
}
