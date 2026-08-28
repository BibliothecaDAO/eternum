import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildGroundTextureCatalog } from "./build-ground-texture-arrays.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIRECTORY = resolve(SCRIPT_DIRECTORY, "../../public/textures/procedural-terrain");

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const args = process.argv.slice(2);
const result = await buildGroundTextureCatalog({
  ktxBinary: readOption(args, "--ktx-bin") ?? process.env.KTX_BIN,
  manifestPath: join(SCRIPT_DIRECTORY, "ground-material-full-source.json"),
  outputDirectory: resolve(readOption(args, "--output-dir") ?? DEFAULT_OUTPUT_DIRECTORY),
  outputPrefix: "ground",
  sourceDirectory: readOption(args, "--source-dir") ?? process.env.TERRAIN_GROUND_SOURCE_DIR,
});
console.log(JSON.stringify(result, null, 2));
