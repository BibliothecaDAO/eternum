import { execFileSync } from "node:child_process";
import { renameSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const app = new URL("../../", import.meta.url);
const input = fileURLToPath(new URL("public/models/ethereal/spire.glb", app));
const output = input.replace(/\.glb$/, ".compressed.glb");
const beforeBytes = statSync(input).size;
execFileSync(
  process.execPath,
  [fileURLToPath(new URL("scripts/compress-models.mjs", app)), "--only", "ethereal/spire.glb"],
  { stdio: "inherit" },
);
// Draco preserves the baked transforms required by the instanced structure renderer.
execFileSync(
  fileURLToPath(new URL("node_modules/.bin/gltf-transform", app)),
  ["draco", input, output, "--method", "edgebreaker"],
  { stdio: "inherit" },
);
renameSync(output, input);
const report = { beforeBytes, afterBytes: statSync(input).size };
writeFileSync(
  new URL("../../../../.context/ethereal-layer/spire/compression.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
