import { Box3, BufferAttribute, BufferGeometry, Mesh, Vector3, type Material } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import boxes from "./realm-kit-boxes.json";
import { REALM_KIT_RING, type RealmKitLevel } from "./realm-kit-design";

const LEVEL_KEYS = ["settlement", "city", "kingdom", "empire"] as const;
const BOX_MARGIN = 0.01;

/** One module's surface in one of the shipped model's materials. */
export interface RealmKitPart {
  geometry: BufferGeometry;
  material: Material;
}

export interface RealmKitModule {
  parts: RealmKitPart[];
  /** Footprint centre at the module's base: the point a placement moves and scales about. */
  pivot: Vector3;
  triangles: number;
}

/**
 * The shipped realm, cut into the kit's modules. The production mesh keeps every block of its editable source as a
 * loose island, so each island goes to the module whose source parts contain its centre; anything else is the ring.
 */
export function cutRealmKit(gltf: GLTF, level: RealmKitLevel): Map<string, RealmKitModule> {
  const moduleBoxes = Object.entries(boxes[LEVEL_KEYS[level]] as Record<string, number[][]>);
  const sorted = new Map<string, Map<Material, number[]>>();
  const sources: Array<{ geometry: BufferGeometry; material: Material }> = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((node) => {
    if (!(node instanceof Mesh) || Array.isArray(node.material)) return;
    sources.push({ geometry: node.geometry.clone().applyMatrix4(node.matrixWorld), material: node.material });
  });
  for (const source of sources) {
    for (const island of findIslands(source.geometry)) {
      const module = classifyIsland(island.center, moduleBoxes);
      const byMaterial = sorted.get(module) ?? new Map<Material, number[]>();
      const triangles = byMaterial.get(source.material) ?? [];
      triangles.push(...island.triangles);
      byMaterial.set(source.material, triangles);
      sorted.set(module, byMaterial);
    }
  }
  const geometryOf = new Map(sources.map((source) => [source.material, source.geometry]));
  return new Map(
    [...sorted].map(([module, byMaterial]) => {
      const parts = [...byMaterial].map(([material, triangles]) => ({
        material,
        geometry: extractTriangles(geometryOf.get(material)!, triangles),
      }));
      return [module, { parts, pivot: measurePivot(parts), triangles: countTriangles(parts) }];
    }),
  );
}

interface Island {
  triangles: number[];
  center: Vector3;
}

function findIslands(geometry: BufferGeometry): Island[] {
  const index = geometry.index!.array;
  const position = geometry.getAttribute("position");
  const parent = Int32Array.from({ length: position.count }, (_, vertex) => vertex);
  const root = (vertex: number): number => {
    while (parent[vertex] !== vertex) vertex = parent[vertex] = parent[parent[vertex]];
    return vertex;
  };
  for (let corner = 0; corner < index.length; corner += 3) {
    const a = root(index[corner]);
    parent[root(index[corner + 1])] = a;
    parent[root(index[corner + 2])] = a;
  }
  const islands = new Map<number, Island & { weight: number }>();
  const point = new Vector3();
  for (let corner = 0; corner < index.length; corner += 3) {
    const key = root(index[corner]);
    const island = islands.get(key) ?? { triangles: [], center: new Vector3(), weight: 0 };
    island.triangles.push(corner / 3);
    for (let offset = 0; offset < 3; offset++) {
      island.center.add(point.fromBufferAttribute(position, index[corner + offset]));
      island.weight++;
    }
    islands.set(key, island);
  }
  return [...islands.values()].map(({ triangles, center, weight }) => ({
    triangles,
    center: center.divideScalar(weight),
  }));
}

/** The smallest source part holding the island's centre names its module. */
function classifyIsland(center: Vector3, moduleBoxes: Array<[string, number[][]]>): string {
  let best = REALM_KIT_RING;
  let bestVolume = Infinity;
  for (const [module, list] of moduleBoxes) {
    for (const [x0, y0, z0, x1, y1, z1] of list) {
      const inside =
        center.x >= x0 - BOX_MARGIN &&
        center.x <= x1 + BOX_MARGIN &&
        center.y >= y0 - BOX_MARGIN &&
        center.y <= y1 + BOX_MARGIN &&
        center.z >= z0 - BOX_MARGIN &&
        center.z <= z1 + BOX_MARGIN;
      const volume = (x1 - x0 + BOX_MARGIN) * (y1 - y0 + BOX_MARGIN) * (z1 - z0 + BOX_MARGIN);
      if (inside && volume < bestVolume) {
        best = module;
        bestVolume = volume;
      }
    }
  }
  return best;
}

function extractTriangles(source: BufferGeometry, triangles: number[]): BufferGeometry {
  const sourceIndex = source.index!.array;
  const remap = new Map<number, number>();
  const index: number[] = [];
  for (const triangle of triangles) {
    for (let offset = 0; offset < 3; offset++) {
      const vertex = sourceIndex[triangle * 3 + offset];
      if (!remap.has(vertex)) remap.set(vertex, remap.size);
      index.push(remap.get(vertex)!);
    }
  }
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes) as Array<[string, BufferAttribute]>) {
    const size = attribute.itemSize;
    const values = new (attribute.array.constructor as new (length: number) => typeof attribute.array)(
      remap.size * size,
    );
    for (const [from, to] of remap) {
      for (let component = 0; component < size; component++) {
        values[to * size + component] = attribute.array[from * size + component];
      }
    }
    geometry.setAttribute(name, new BufferAttribute(values, size, attribute.normalized));
  }
  geometry.setIndex(index);
  return geometry;
}

function measurePivot(parts: RealmKitPart[]): Vector3 {
  const bounds = new Box3();
  for (const { geometry } of parts) {
    geometry.computeBoundingBox();
    bounds.union(geometry.boundingBox!);
  }
  const center = bounds.getCenter(new Vector3());
  return new Vector3(center.x, Math.max(0, bounds.min.y), center.z);
}

function countTriangles(parts: RealmKitPart[]): number {
  return parts.reduce((sum, { geometry }) => sum + geometry.index!.count / 3, 0);
}
