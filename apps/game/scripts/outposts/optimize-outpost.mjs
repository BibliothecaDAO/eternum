import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../../", import.meta.url));
const root = resolve(app, "../..");
const [input, output] = process.argv.slice(2).map((path) => resolve(path));
if (!input || !output) throw new Error("Provide fresh raw input and compressed output");
for (const path of [input, output]) {
  const location = relative(root, path);
  if (!location.startsWith("..") && !isAbsolute(location))
    throw new Error("Compress into an external build directory before replacing delivered assets");
}
const tool = resolve(app, "node_modules/.bin/gltf-transform");
const temporary = mkdtempSync(resolve(dirname(output), ".outpost-compression-"));
try {
  const normal = resolve(temporary, "normal.glb");
  execFileSync(
    tool,
    [
      "uastc",
      input,
      normal,
      "--slots",
      "normalTexture",
      "--level",
      "2",
      "--rdo",
      "--rdo-lambda",
      "0.5",
      "--zstd",
      "18",
      "--jobs",
      "2",
    ],
    { stdio: "inherit" },
  );
  const textures = resolve(temporary, "textures.glb");
  execFileSync(tool, ["etc1s", normal, textures, "--slots", "baseColorTexture", "--quality", "180", "--jobs", "2"], {
    stdio: "inherit",
  });
  execFileSync(tool, ["draco", textures, output, "--method", "edgebreaker"], { stdio: "inherit" });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
