import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveWonderDesign, resolveAgeWonderDesign } from "../../src/three/structures/wonder-design.mjs";

const app = fileURLToPath(new URL("../../", import.meta.url));
const assets = JSON.parse(readFileSync(resolve(app, "src/three/structures/realm-assets.json"), "utf8"));
const { values } = parseArgs({
  options: {
    verify: { type: "boolean", default: false },
    asset: { type: "string" },
    blender: { type: "string", default: "blender" },
    output: { type: "string" },
  },
});
if (values.asset && !assets.some((asset) => asset.id === values.asset))
  throw new Error(`Unknown realm ${values.asset}`);
const selected = assets.filter((asset) => !values.asset || asset.id === values.asset);
if (!values.verify && !values.output)
  throw new Error(
    "Export into a fresh --output directory, verify it, then copy the picked GLBs to public/models/realms",
  );
const output = values.output && resolve(values.output);
if (output && !values.verify) mkdirSync(output);
for (const asset of selected) {
  const delivered = output ? resolve(output, `${asset.id}.glb`) : resolve(app, `public${asset.path}`);
  if (!values.verify) exportAsset(asset, delivered);
  run("python3", [resolve(app, "scripts/realms/verify-citadel.py"), delivered]);
}

function exportAsset(asset, delivered) {
  const raw = resolve(output, `${asset.id}-raw.glb`);
  const design =
    asset.id === "standing-stones"
      ? resolveAgeWonderDesign("settlement", 1003)
      : asset.seed
        ? resolveWonderDesign(asset.seed)
        : null;
  const args = [
    "--background",
    resolve(app, "asset-sources/realms", asset.source),
    "--threads",
    "2",
    "--python-exit-code",
    "1",
    "--python",
    resolve(app, "scripts/realms/export-citadel.py"),
    "--",
    raw,
  ];
  if (design) {
    const descriptor = resolve(output, `${asset.id}-design.json`);
    writeFileSync(descriptor, JSON.stringify(design));
    args.push("--design", descriptor);
  }
  run(values.blender, args);
  run(process.execPath, [resolve(app, "scripts/compress-models.mjs"), "--only", raw]);
  run(resolve(app, "node_modules/.bin/gltf-transform"), [
    "draco",
    raw,
    delivered,
    "--method",
    "edgebreaker",
    "--quantize-position",
    "20",
  ]);
}
function run(command, args) {
  execFileSync(command, args, { cwd: app, stdio: "inherit" });
}
