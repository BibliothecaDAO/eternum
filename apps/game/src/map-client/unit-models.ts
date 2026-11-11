import { MeshoptSimplifier } from "meshoptimizer";
import {
  Matrix3,
  Mesh,
  SkinnedMesh,
  Vector2,
  Vector3,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  type Material,
  type Object3D,
  type Texture,
} from "three";

import { TROOP_TO_MODEL, buildArmyModelAssetPath } from "@/three/constants/army-constants";
import { gltfLoader } from "@/three/utils/utils";
import { TroopTier, TroopType } from "@bibliothecadao/types";

/**
 * How many triangles a model keeps at each of its three finenesses, from the closest look to a crowd seen from afar.
 * The finest keeps the model's texture, so it is cut only as far as the texture's seams allow; the other two are
 * painted at their vertices and cut freely.
 */
const BODY_TRIANGLES = [2_400, 800, 220];
const SWORD_TRIANGLES = [200, 60, 12];
const SHIELD_TRIANGLES = [300, 80, 24];

/**
 * The game's own unit models the map's renderer poses by maths: the articulated T1 knight with its sword and shield,
 * and the crossbowman and the mounted paladin, which are statues.
 */
const KIT_MODELS = {
  knight: { path: "/models/characters/t1-knight-default/mid/skin.glb", triangles: BODY_TRIANGLES },
  sword: { path: "/models/characters/t1-knight-default/near/sword.glb", triangles: SWORD_TRIANGLES },
  shield: { path: "/models/characters/t1-knight-default/near/shield.glb", triangles: SHIELD_TRIANGLES },
  crossbowman: {
    path: buildArmyModelAssetPath(TROOP_TO_MODEL[TroopType.Crossbowman][TroopTier.T1]),
    triangles: BODY_TRIANGLES,
  },
  paladin: {
    path: buildArmyModelAssetPath(TROOP_TO_MODEL[TroopType.Paladin][TroopTier.T1]),
    triangles: BODY_TRIANGLES,
  },
} as const;

interface KitPart {
  /** The names of the nodes the part hangs from, outermost first, then its own. */
  path: string[];
  vertexOffset: number;
  vertexCount: number;
  /** Where each vertex's joints and weights are, in floats; -1 for a part with no skin. */
  skinOffset: number;
  /** Where each vertex's own colour is, three floats each: its texture's colour there. */
  paintOffset: number;
  levels: Array<{ indexOffset: number; indexCount: number }>;
  texture: number;
}

interface KitJoint {
  name: string;
  /** Where the joint is at rest, in the model's own space. */
  at: number[];
}

export interface KitModel {
  name: string;
  parts: KitPart[];
  joints: KitJoint[];
  /** The joints a skinned vertex names, in the order it numbers them. */
  bones: string[];
}

/** A texture as the snapshot carries it: its place among the snapshot's textures, and its pixels. */
export interface KitTexture {
  index: number;
  /** RGBA, a byte each, `size` square. */
  pixels: Uint8Array;
  size: number;
}
export type TextureReader = (map: Texture) => Promise<KitTexture>;

/** Loads every unit model, each part simplified to three finenesses, into the scene's floats. */
export async function appendUnitModels(floats: number[], textureOf: TextureReader): Promise<KitModel[]> {
  await MeshoptSimplifier.ready;
  const models: KitModel[] = [];
  for (const [name, { path, triangles }] of Object.entries(KIT_MODELS)) {
    const { scene } = await gltfLoader.loadAsync(path);
    scene.updateMatrixWorld(true);
    models.push(await readModel(floats, name, scene, triangles, textureOf));
  }
  return models;
}

async function readModel(
  floats: number[],
  name: string,
  scene: Object3D,
  levelTriangles: readonly number[],
  textureOf: TextureReader,
): Promise<KitModel> {
  const meshes: Mesh[] = [];
  const joints: KitJoint[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
    else if (object.name) joints.push({ name: object.name, at: object.getWorldPosition(new Vector3()).toArray() });
  });
  const triangles = meshes.reduce((total, mesh) => total + triangleCount(mesh), 0);
  const skinned = meshes.find((mesh): mesh is SkinnedMesh => mesh instanceof SkinnedMesh);
  const shares = levelTriangles.map((wanted) => Math.min(1, wanted / triangles));
  const parts: KitPart[] = [];
  for (const mesh of meshes) parts.push(await readPart(floats, mesh, shares, textureOf));
  return {
    name,
    parts,
    joints,
    bones: skinned?.skeleton.bones.map((bone) => bone.name) ?? [],
  };
}

async function readPart(
  floats: number[],
  mesh: Mesh,
  /** The share of its triangles the part keeps at each fineness. */
  shares: number[],
  textureOf: TextureReader,
): Promise<KitPart> {
  const material = mesh.material as Material & { map?: Texture | null; color?: { r: number; g: number; b: number } };
  const vertexOffset = floats.length;
  const { positions, coordinates } = appendModelVertices(
    floats,
    mesh,
    material.color ?? { r: 1, g: 1, b: 1 },
    material.map ?? null,
  );
  const skinOffset = mesh instanceof SkinnedMesh ? appendSkin(floats, mesh) : -1;
  const texture = material.map ? await textureOf(material.map) : null;
  const paintOffset = floats.length;
  const paint = paintAt(coordinates, texture);
  for (const value of paint) floats.push(value);
  const indices = readIndices(mesh);
  const levels = shares.map((share, fineness) => {
    const kept =
      share >= 1
        ? indices
        : fineness === 0
          ? alongSeams(indices, positions, share)
          : simplify(indices, positions, paint, share);
    const indexOffset = floats.length;
    for (const value of new Float32Array(kept.buffer, kept.byteOffset, kept.length)) floats.push(value);
    return { indexOffset, indexCount: kept.length };
  });
  return {
    path: pathOf(mesh),
    vertexOffset,
    vertexCount: positions.length / 3,
    skinOffset,
    paintOffset,
    levels,
    texture: texture?.index ?? -1,
  };
}

/** Each vertex's colour, three floats each: its texture's where it sits on it, white with no texture. */
function paintAt(coordinates: Float32Array, texture: KitTexture | null): Float32Array {
  const paint = new Float32Array((coordinates.length / 2) * 3).fill(1);
  if (!texture) return paint;
  const { pixels, size } = texture;
  const wrapped = (value: number) => Math.min(size - 1, Math.floor((value - Math.floor(value)) * size));
  for (let vertex = 0; vertex < coordinates.length / 2; vertex += 1) {
    const texel = (wrapped(coordinates[vertex * 2 + 1]) * size + wrapped(coordinates[vertex * 2])) * 4;
    for (let channel = 0; channel < 3; channel += 1) paint[vertex * 3 + channel] = pixels[texel + channel] / 255;
  }
  return paint;
}

/** How far a cut may move the surface, as a share of the part's size: a tenth, then, for a crowd's model, a fifth. */
const CUT_ERROR = 0.1;
const ROUGH_CUT_ERROR = 0.2;

/** How much a vertex's colour weighs against its place in space when a cut joins two vertices. */
const PAINT_WEIGHT = 0.5;

const wantedIndices = (indices: Uint32Array, share: number) =>
  Math.max(3, Math.floor((indices.length * share) / 3) * 3);

/** The part's triangles cut toward a share of them, never across its texture's seams: its texture still fits. */
function alongSeams(indices: Uint32Array, positions: Float32Array, share: number): Uint32Array {
  return MeshoptSimplifier.simplify(indices, positions, 3, wantedIndices(indices, share), CUT_ERROR)[0];
}

/**
 * The part's triangles cut to a share of them, for a part painted at its vertices: the cut crosses the texture's
 * seams, keeping vertices of like colour together. Where that leaves more than half again the count asked for, the
 * part is cut with no regard for how its triangles join.
 */
function simplify(indices: Uint32Array, positions: Float32Array, paint: Float32Array, share: number): Uint32Array {
  const wanted = wantedIndices(indices, share);
  const weights = [PAINT_WEIGHT, PAINT_WEIGHT, PAINT_WEIGHT];
  const [kept] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    positions,
    3,
    paint,
    3,
    weights,
    null,
    wanted,
    CUT_ERROR,
    ["Permissive"],
  );
  if (kept.length <= wanted * 1.5) return kept;
  return MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, wanted, ROUGH_CUT_ERROR)[0];
}

export function appendModelVertices(
  floats: number[],
  mesh: Mesh,
  base: { r: number; g: number; b: number },
  map: Texture | null,
): { positions: Float32Array; coordinates: Float32Array } {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  const uv = textureAttribute(mesh, map);
  // A part may be coloured vertex by vertex, under its texture.
  const colour = geometry.getAttribute("color");
  const facing = new Matrix3().getNormalMatrix(mesh.matrixWorld);
  const positions = new Float32Array(position.count * 3);
  const coordinates = new Float32Array(position.count * 2);
  const at = new Vector3();
  const toward = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    at.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    toward.fromBufferAttribute(normal, index).applyMatrix3(facing).normalize();
    at.toArray(positions, index * 3);
    const tint = colour ? [colour.getX(index), colour.getY(index), colour.getZ(index)] : [1, 1, 1];
    floats.push(at.x, at.y, at.z, toward.x, toward.y, toward.z);
    floats.push(base.r * tint[0], base.g * tint[1], base.b * tint[2], 0);
    const on = textureCoordinates(uv, index, map);
    coordinates.set(on, index * 2);
    floats.push(...on);
  }
  return { positions, coordinates };
}

/** The coordinates a mesh's texture is laid by: a texture may name another set than the first. */
function textureAttribute(mesh: Mesh, map: Texture | null) {
  return mesh.geometry.getAttribute(map?.channel ? `uv${map.channel}` : "uv");
}

/**
 * Where a vertex sits on its baked texture: a model may hold its coordinates packed, with the texture's own
 * transform to unpack them, and its v may run down the image.
 */
function textureCoordinates(
  uv: BufferAttribute | InterleavedBufferAttribute | undefined,
  index: number,
  map: Texture | null,
): [number, number] {
  if (!uv) return [0, 0];
  const at = new Vector2(uv.getX(index), uv.getY(index));
  if (map) {
    if (map.matrixAutoUpdate) map.updateMatrix();
    at.applyMatrix3(map.matrix);
  }
  return [at.x, map?.flipY ? 1 - at.y : at.y];
}

function appendSkin(floats: number[], mesh: SkinnedMesh): number {
  const joints = mesh.geometry.getAttribute("skinIndex");
  const weights = mesh.geometry.getAttribute("skinWeight");
  const offset = floats.length;
  for (let index = 0; index < joints.count; index += 1) {
    for (let slot = 0; slot < 4; slot += 1) floats.push(joints.getComponent(index, slot));
    for (let slot = 0; slot < 4; slot += 1) floats.push(weights.getComponent(index, slot));
  }
  return offset;
}

function readIndices(mesh: Mesh): Uint32Array {
  const { index } = mesh.geometry;
  const count = index?.count ?? mesh.geometry.getAttribute("position").count;
  return Uint32Array.from({ length: count }, (_, at) => (index ? index.getX(at) : at));
}

function triangleCount(mesh: Mesh): number {
  return (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3;
}

function pathOf(mesh: Object3D): string[] {
  const names: string[] = [];
  for (let node: Object3D | null = mesh; node; node = node.parent) if (node.name) names.unshift(node.name);
  return names;
}
