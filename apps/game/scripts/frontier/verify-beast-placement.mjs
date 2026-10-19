import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { fileURLToPath } from "node:url";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco.createDecoderModule(),
});

/** Read delivered triangles without changing either model. Roaming beasts have no ruin. */
export async function measureBeastPlacement(species, scale, ruinPath) {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Scale must be positive");
  const assetId = `beast-${species}`;
  const ruin = ruinPath ? await readGeometry("ruin", ruinPath) : { vertices: [], triangles: [] };
  const beast = await readGeometry(assetId);
  return measurePlacement({ assetId, ruin, beast, scale });
}

async function readGeometry(name, override) {
  const path = override ?? fileURLToPath(new URL(`../../public/models/frontier/${name}.glb`, import.meta.url));
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

const CLEARANCE = 0.001;
const GROUND_HEIGHT = 0.003;
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Measure the delivered surfaces, excluding only the ruin's painted ground support. */
export function measurePlacement({ assetId, ruin, beast, scale }) {
  const vertices = beast.vertices.map((point) => point.map((value) => value * scale));
  const fitsTile = vertices.every((point) =>
    [0, Math.PI / 3, (2 * Math.PI) / 3].every(
      (angle) => Math.abs(point[0] * Math.cos(angle) + point[2] * Math.sin(angle)) <= Math.sqrt(3) / 2,
    ),
  );
  const obstacles = ruin.triangles
    .map((face) => triangle(face.map((index) => ruin.vertices[index])))
    .filter((face) => face.max[1] > GROUND_HEIGHT)
    .sort((a, b) => a.min[0] - b.min[0]);
  let masonryContacts = 0;
  const touched = new Set();
  for (const face of beast.triangles) {
    const body = triangle(face.map((index) => vertices[index]));
    for (const wall of obstacles) {
      if (wall.min[0] > body.max[0] + CLEARANCE) break;
      if (!boundsOverlap(body, wall) || separated(body, wall)) continue;
      masonryContacts++;
      touched.add(wall);
    }
  }
  return {
    assetId,
    scale,
    fitsTile,
    masonryContacts,
    contactBounds: [...touched].map((wall) => wall.points),
    passed: fitsTile && masonryContacts === 0,
    method:
      "Decoded GLB triangles at runtime scale and shared ground-center origin; separating axes with 0.001 clearance tolerance",
  };
}

function triangle(points) {
  const edges = points.map((point, index) => subtract(points[(index + 1) % 3], point));
  return {
    points,
    edges,
    normal: cross(edges[0], edges[1]),
    min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  };
}

function boundsOverlap(a, b) {
  return [0, 1, 2].every((axis) => a.min[axis] <= b.max[axis] + CLEARANCE && b.min[axis] <= a.max[axis] + CLEARANCE);
}

function separated(a, b) {
  const axes = [a.normal, b.normal, ...a.edges.flatMap((edge) => b.edges.map((other) => cross(edge, other)))];
  // In-plane edge normals also separate coplanar triangles with overlapping boxes.
  for (const face of [a, b]) axes.push(...face.edges.map((edge) => cross(face.normal, edge)));
  return axes.some((axis) => {
    const length = Math.hypot(...axis);
    if (length < 1e-12) return false;
    const left = a.points.map((point) => dot(point, axis));
    const right = b.points.map((point) => dot(point, axis));
    const margin = CLEARANCE * length;
    return Math.max(...left) + margin < Math.min(...right) || Math.max(...right) + margin < Math.min(...left);
  });
}
