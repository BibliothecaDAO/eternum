import { execFileSync } from "node:child_process";
import { renameSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const app = new URL("../../", import.meta.url);
const transform = fileURLToPath(new URL("node_modules/.bin/gltf-transform", app));
const compress = fileURLToPath(new URL("scripts/compress-models.mjs", app));
const report = [];
for (const army of ["knight", "crossbowman", "paladin"]) {
  for (const tier of [1, 2, 3]) {
    const name = `${army}-t${tier}.glb`;
    const input = fileURLToPath(new URL(`public/models/ships/${name}`, app));
    const output = input.replace(/\.glb$/, ".compressed.glb");
    const beforeBytes = statSync(input).size;
    try {
      execFileSync(process.execPath, [compress, "--only", `ships/${name}`], { stdio: "inherit" });
      execFileSync(transform, ["draco", input, output, "--method", "edgebreaker"], { stdio: "inherit" });
      renameSync(output, input);
      report.push({ asset: name, beforeBytes, afterBytes: statSync(input).size });
    } finally {
      rmSync(output, { force: true });
    }
  }
}
console.log(JSON.stringify(report, null, 2));
