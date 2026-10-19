import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { basename } from "node:path";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Provide a compressed outpost GLB");
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const document = await io.read(path);
const bytes = readFileSync(path);
const json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
const primitives = document
  .getRoot()
  .listMeshes()
  .flatMap((mesh) => mesh.listPrimitives());
const triangles = primitives.reduce((total, primitive) => total + primitive.getIndices().getCount() / 3, 0);
if (triangles < 500 || triangles > 6296 || primitives.length > 5 || bytes.length > 257144) {
  throw new Error("Revise construction: small landmarks allow 500–6296 triangles, five primitives and 257144 bytes");
}
if (document.getRoot().listAnimations().length) throw new Error("Outposts must remain static");
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const node of document.getRoot().listNodes()) {
  if (node.getWorldMatrix().some((value, index) => Math.abs(value - identity[index]) > 1e-6))
    throw new Error("Bake every production transform for structure instancing");
}
if (["camp.glb", "village.glb", "beasts.glb"].includes(basename(path)) || basename(path).startsWith("village-")) {
  const cloth = document
    .getRoot()
    .listNodes()
    .filter((node) => node.getExtras().relationshipCloth === "trim");
  if (cloth.length !== 1 || cloth[0].getMesh()?.listPrimitives().length !== 1)
    throw new Error(
      "Keep ownership cloth as one separate mesh with relationshipCloth=trim; preserve the modeled emblem",
    );
  const clothTriangles = cloth[0].getMesh().listPrimitives()[0].getIndices().getCount() / 3;
  if (clothTriangles < 10 || clothTriangles > triangles / 4)
    throw new Error("Ownership color must reach the cloth, without recoloring the body");
}
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (const primitive of primitives) {
  if (!primitive.getAttribute("COLOR_0") || !primitive.getAttribute("TEXCOORD_0"))
    throw new Error("Export surface tint and packed contact-bake UVs");
  const positions = primitive.getAttribute("POSITION");
  for (let i = 0; i < positions.getCount(); i++) {
    const point = positions.getElement(i, []);
    const [x, y, z] = point;
    if (
      y < -0.032 ||
      Array.from(
        { length: 6 },
        (_, side) => x * Math.cos((side * Math.PI) / 3) + z * Math.sin((side * Math.PI) / 3),
      ).some((distance) => distance > Math.sqrt(3) / 2 + 0.001)
    )
      throw new Error("Remodel footprint inside the radius-one hex and 0.031 contact skirt");
    point.forEach((value, axis) => {
      bounds.min[axis] = Math.min(bounds.min[axis], value);
      bounds.max[axis] = Math.max(bounds.max[axis], value);
    });
  }
}
const villageYard = ["village.glb", "village-canvas-thatch.glb"].includes(basename(path))
  ? verifyVillageYard(primitives)
  : undefined;

const textures = document.getRoot().listTextures();
if (
  !textures.length ||
  textures.length > 2 ||
  textures.some((texture) => texture.getMimeType() !== "image/ktx2" || texture.getSize().some((size) => size > 480))
)
  throw new Error("Pack at most two KTX2 textures at 480 px or less");
if (
  !json.meshes.every((mesh) => mesh.primitives.every((primitive) => primitive.extensions?.KHR_draco_mesh_compression))
)
  throw new Error("Compress all primitives with Draco");
console.log(
  JSON.stringify({
    path,
    bytes: bytes.length,
    triangles,
    primitives: primitives.length,
    materials: document.getRoot().listMaterials().length,
    textures: textures.map((texture) => texture.getSize()),
    bounds,
    ...(villageYard ? { villageYard } : {}),
  }),
);

function verifyVillageYard(primitives) {
  let architectureVertices = 0;
  const yard = JSON.parse(readFileSync(new URL("./village-yard.json", import.meta.url), "utf8"));
  if (![yard.fenceRadius, yard.postRadius, yard.clearance].every((value) => Number.isFinite(value) && value > 0))
    throw new Error("Set positive fenceRadius, postRadius and clearance in village-yard.json");
  const fenceInnerApothem = (yard.fenceRadius * Math.sqrt(3)) / 2 - yard.postRadius;
  let architectureApothem = 0;
  for (const primitive of primitives) {
    const marker = primitive.getAttribute("_YARD_ARCHITECTURE");
    const positions = primitive.getAttribute("POSITION");
    if (!marker) throw new Error("Preserve the village's _YARD_ARCHITECTURE vertex attribute through export");
    for (let i = 0; i < positions.getCount(); i++) {
      if (marker.getScalar(i) < 0.5) continue;
      architectureVertices++;
      const [x, , z] = positions.getElement(i, []);
      for (let side = 0; side < 6; side++)
        architectureApothem = Math.max(
          architectureApothem,
          x * Math.cos((side * Math.PI) / 3) + z * Math.sin((side * Math.PI) / 3),
        );
    }
  }
  const clearance = fenceInnerApothem - architectureApothem;
  if (!architectureVertices || clearance < yard.clearance - 0.001)
    throw new Error(
      `Move village architecture inside the fence with ${yard.clearance} ground clearance. Got ${clearance.toFixed(3)}.`,
    );
  return { architectureVertices, architectureApothem, fenceInnerApothem, clearance };
}
