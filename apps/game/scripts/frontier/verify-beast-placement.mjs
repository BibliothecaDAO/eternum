import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const assetId = process.argv[2];
if (!/^beast-(troll|wyvern|hydra)$/.test(assetId ?? "")) {
  throw new Error("Provide beast-troll, beast-wyvern or beast-hydra");
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco.createDecoderModule(),
});
const ruin = await readGeometry("fallen-realm-ruin");
const beast = await readGeometry(assetId);
const measurement = measurePlacement({ assetId, ruin, beast });
console.log(JSON.stringify(measurement));

async function readGeometry(name) {
  const path = fileURLToPath(new URL(`../../public/models/frontier/${name}.glb`, import.meta.url));
  const document = await io.read(path);
  const vertices = [];
  const triangles = [];
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh().listPrimitives()) {
      const positions = primitive.getAttribute("POSITION");
      const offset = vertices.length;
      for (let index = 0; index < positions.getCount(); index++) {
        const [x, y, z] = positions.getElement(index, []);
        vertices.push([
          matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
          matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
          matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
        ]);
      }
      const indices = primitive.getIndices();
      const count = indices?.getCount() ?? positions.getCount();
      for (let index = 0; index < count; index += 3) {
        triangles.push([0, 1, 2].map((corner) => offset + (indices?.getScalar(index + corner) ?? index + corner)));
      }
    }
  }
  return { vertices, triangles };
}

function measurePlacement(geometry) {
  const script = fileURLToPath(new URL("measure-beast-placement.py", import.meta.url));
  const result = spawnSync(
    "blender",
    ["--background", "--threads", "2", "--python-exit-code", "1", "--python", script],
    {
      input: JSON.stringify(geometry),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr + result.stdout);
  const report = result.stdout.split("\n").find((line) => line.startsWith("FRONTIER_PLACEMENT="));
  if (!report) throw new Error("Blender did not return a placement measurement");
  return JSON.parse(report.slice("FRONTIER_PLACEMENT=".length));
}
