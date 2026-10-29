#!/usr/bin/env node
/**
 * Heavier copies of the game's models, for measuring what richer art would cost in the real client: each triangle split
 * into four (`--triangles 4`, or 16 for two passes) and each KTX2 texture at twice its size per side (`--textures 2`),
 * the look and the compression unchanged. The copies are written under `--out` at their path below `public/models`, as
 * the playtest's `--model-override <dir>` serves them in place of the deployed models.
 *
 *   node scripts/client-playtest/heavier-models.mjs --triangles 4 --textures 2 --out <dir> frontier/painted/farm-1.glb …
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const MODELS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/models");
const TRIANGLES = 4;

/** The command's options, refused when they cannot describe a copy. */
export function readHeavierModelOptions(argv) {
  const option = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const triangles = Number(option("--triangles", "1"));
  const textures = Number(option("--textures", "1"));
  if (![1, 4, 16].includes(triangles)) throw new Error(`--triangles takes 1, 4 or 16, not "${triangles}"`);
  if (![1, 2].includes(textures)) throw new Error(`--textures takes 1 or 2, not "${textures}"`);
  const out = option("--out", null);
  if (!out) throw new Error("--out <dir> is required");
  const valued = new Set(["--triangles", "--textures", "--out"]);
  const models = argv.filter((arg, index) => !arg.startsWith("--") && !valued.has(argv[index - 1]));
  if (models.length === 0) throw new Error("name at least one model below public/models");
  return { models, out: resolve(out), textures, triangles };
}

/**
 * Splits every edge of an indexed triangle primitive at its midpoint, shared between the triangles on either side: four
 * triangles for one, with each vertex attribute (its morph targets' too) the mean of the edge's ends. Returns false for
 * a primitive it leaves alone: no indices, or not triangles.
 */
export function splitTriangles(primitive) {
  const indices = primitive.getIndices();
  if (!indices || primitive.getMode() !== 4) return false;
  if (primitive.listSemantics().some((semantic) => semantic.startsWith("JOINTS_"))) {
    throw new Error(
      `${primitive.getName() || "a primitive"} is skinned: a midpoint of two joints' indices is no joint`,
    );
  }
  const attributes = [primitive, ...primitive.listTargets()].flatMap((owner) =>
    owner.listSemantics().map((semantic) => owner.getAttribute(semantic)),
  );
  const source = attributes.map((accessor) => Array.from(accessor.getArray()));
  const sizes = attributes.map((accessor) => accessor.getElementSize());
  const vertexCount = attributes[0].getCount();
  const midpoints = new Map();
  const midpointOf = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!midpoints.has(key)) {
      midpoints.set(key, vertexCount + midpoints.size);
      attributes.forEach((accessor, slot) => {
        const size = sizes[slot];
        for (let component = 0; component < size; component += 1) {
          const mean = (source[slot][a * size + component] + source[slot][b * size + component]) / 2;
          source[slot].push(isFloat(accessor) ? mean : Math.round(mean));
        }
      });
    }
    return midpoints.get(key);
  };
  const before = Array.from(indices.getArray());
  const after = [];
  for (let corner = 0; corner < before.length; corner += 3) {
    const [a, b, c] = before.slice(corner, corner + 3);
    const [ab, bc, ca] = [midpointOf(a, b), midpointOf(b, c), midpointOf(c, a)];
    after.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  attributes.forEach((accessor, slot) => accessor.setArray(new (accessor.getArray().constructor)(source[slot])));
  indices.setArray(vertexCount + midpoints.size > 0xffff ? new Uint32Array(after) : new Uint16Array(after));
  return true;
}

/**
 * Splits each geometry once, however many primitives draw it (a prop's near and far forms may be one). A primitive that
 * shares only its index list with other vertices (a run of 0, 1, 2… reused) gets its own copy of the list first.
 */
function splitEachGeometryOnce(document) {
  const primitives = document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives());
  const positionsOf = new Map();
  for (const primitive of primitives) {
    const indices = primitive.getIndices();
    if (!indices) continue;
    const position = primitive.getAttribute("POSITION");
    if (positionsOf.has(indices) && positionsOf.get(indices) !== position) primitive.setIndices(indices.clone());
    else positionsOf.set(indices, position);
  }
  new Set(primitives.filter((primitive) => primitive.getIndices()).map((primitive) => primitive.getIndices())).forEach(
    (indices) => splitTriangles(primitives.find((primitive) => primitive.getIndices() === indices)),
  );
}

/** The triangles a document's indexed triangle primitives draw. */
const countTriangles = (document) =>
  document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .filter((primitive) => primitive.getIndices() && primitive.getMode() === 4)
    .reduce((total, primitive) => total + primitive.getIndices().getCount() / 3, 0);

const isFloat = (accessor) => accessor.getComponentType() === 5126;

/** A KTX2 image at twice its size per side, encoded as it was (ETC1S or UASTC), with its mip chain. */
function doubleKtx2(image, workDir) {
  const original = join(workDir, "original.ktx2");
  const decoded = join(workDir, "decoded.png");
  const doubled = join(workDir, "doubled.png");
  const encoded = join(workDir, "doubled.ktx2");
  writeFileSync(original, image);
  execFileSync("ktx", ["extract", "--transcode", "rgba8", original, decoded]);
  const width = image.readUInt32LE(20);
  const isUastc = image.readUInt32LE(44) !== 1;
  return sharp(decoded)
    .resize(width * 2)
    .png()
    .toFile(doubled)
    .then(() => {
      execFileSync("toktx", ["--t2", "--genmipmap", "--encode", isUastc ? "uastc" : "etc1s", encoded, doubled]);
      return readFileSync(encoded);
    });
}

async function writeHeavierModel(io, model, { out, textures, triangles }) {
  const document = await io.read(join(MODELS_DIR, model));
  const report = { model, triangles: { before: countTriangles(document) }, textures: [] };
  for (let factor = 1; factor < triangles; factor *= TRIANGLES) splitEachGeometryOnce(document);
  report.triangles.after = countTriangles(document);
  if (textures === 2) {
    const workDir = mkdtempSync(join(tmpdir(), "heavier-models-"));
    try {
      for (const texture of document.getRoot().listTextures()) {
        if (texture.getMimeType() !== "image/ktx2") continue;
        const [width] = texture.getSize() ?? [texture.getImage().readUInt32LE(20)];
        texture.setImage(await doubleKtx2(Buffer.from(texture.getImage()), workDir));
        report.textures.push({ name: texture.getName(), from: width, to: width * 2 });
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
  const target = join(out, model);
  mkdirSync(dirname(target), { recursive: true });
  await io.write(target, document);
  return report;
}

async function main(argv) {
  const options = readHeavierModelOptions(argv);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const reports = [];
  for (const model of options.models) reports.push(await writeHeavierModel(io, model, options));
  console.log(JSON.stringify({ out: options.out, triangles: options.triangles, textures: options.textures, reports }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
