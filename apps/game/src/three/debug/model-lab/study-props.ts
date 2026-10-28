import {
  BatchedMesh,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import {
  getTerrainPropMeshName,
  TERRAIN_PROP_CATALOG_PATH,
  type TerrainPropArchetypeId,
} from "../../terrain/terrain-prop-catalog";
import { gltfLoader } from "../../utils/utils";

/** One prop the study places: which mesh, where on the ground plane, how big, turned and tinted. */
export interface StudyProp {
  archetype: TerrainPropArchetypeId;
  x: number;
  z: number;
  /** Width and height scale; a mesa is wide and low, a spire narrow and tall. */
  width: number;
  height: number;
  yaw: number;
  tint: readonly [number, number, number];
}

/** Every study prop in one batch with one material: the path a variant-rich kit would draw through. */
export async function drawStudyProps(
  props: StudyProp[],
  groundAt: (x: number, z: number) => number,
): Promise<BatchedMesh> {
  const catalog = await gltfLoader.loadAsync(TERRAIN_PROP_CATALOG_PATH);
  catalog.scene.updateMatrixWorld(true);
  const archetypes = [...new Set(props.map(({ archetype }) => archetype))];
  const geometries = new Map(archetypes.map((archetype) => [archetype, readPropGeometry(catalog.scene, archetype)]));
  const vertices = [...geometries.values()].reduce((sum, geometry) => sum + geometry.getAttribute("position").count, 0);
  const indices = [...geometries.values()].reduce((sum, geometry) => sum + geometry.index!.count, 0);
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  material.name = "biome-study-props";
  const batch = new BatchedMesh(props.length, vertices, indices, material);
  batch.castShadow = batch.receiveShadow = true;
  batch.perObjectFrustumCulled = false;
  const ids = new Map(archetypes.map((archetype) => [archetype, batch.addGeometry(geometries.get(archetype)!)]));
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const tint = new Color();
  for (const prop of props) {
    const instance = batch.addInstance(ids.get(prop.archetype)!);
    matrix.compose(
      new Vector3(prop.x, groundAt(prop.x, prop.z), prop.z),
      rotation.setFromAxisAngle(up, prop.yaw),
      new Vector3(prop.width, prop.height, prop.width),
    );
    batch.setMatrixAt(instance, matrix);
    batch.setColorAt(instance, tint.setRGB(...prop.tint));
  }
  return batch;
}

/** The near mesh in plain floats with its node transform applied, so every prop shares one attribute layout. */
function readPropGeometry(root: Mesh["parent"] & object, archetype: TerrainPropArchetypeId): BufferGeometry {
  const mesh = root.getObjectByName(getTerrainPropMeshName(archetype, "near"));
  if (!(mesh instanceof Mesh)) throw new Error(`Terrain prop catalog has no near mesh for ${archetype}`);
  const source = mesh.geometry as BufferGeometry;
  const geometry = new BufferGeometry();
  const count = source.getAttribute("position").count;
  for (const name of ["position", "normal", "color"] as const) {
    const attribute = source.getAttribute(name);
    const size = name === "color" ? 3 : attribute.itemSize;
    const values = new Float32Array(count * size).fill(1);
    if (attribute) {
      for (let index = 0; index < count; index++) {
        for (let component = 0; component < size; component++) {
          values[index * size + component] = attribute.getComponent(index, component);
        }
      }
    }
    geometry.setAttribute(name, new BufferAttribute(values, size));
  }
  geometry.setIndex(source.index ? Array.from(source.index.array) : Array.from({ length: count }, (_, index) => index));
  geometry.applyMatrix4(mesh.matrixWorld);
  return geometry;
}
