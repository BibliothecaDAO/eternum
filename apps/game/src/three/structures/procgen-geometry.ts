import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const QUANTIZE_SCALE = 100_000;
const MIN_NORMAL_LENGTH_SQ = 1e-12;
const CREASE_ANGLE_DEGREES = 42;

export function computeCreaseNormals(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const positions = flat.getAttribute("position");
  const vertexCount = positions.count;
  const faceCount = Math.floor(vertexCount / 3);
  const cosThreshold = Math.cos((CREASE_ANGLE_DEGREES * Math.PI) / 180);

  const faceNormals = new Float32Array(faceCount * 3);
  const buckets = new Map<string, number[]>();

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const fn = new Vector3();

  for (let f = 0; f < faceCount; f++) {
    const i0 = f * 3;
    a.fromBufferAttribute(positions, i0);
    b.fromBufferAttribute(positions, i0 + 1);
    c.fromBufferAttribute(positions, i0 + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    fn.crossVectors(ab, ac);
    if (fn.lengthSq() > MIN_NORMAL_LENGTH_SQ) {
      fn.normalize();
    } else {
      fn.set(0, 1, 0);
    }
    faceNormals[f * 3] = fn.x;
    faceNormals[f * 3 + 1] = fn.y;
    faceNormals[f * 3 + 2] = fn.z;

    for (let k = 0; k < 3; k++) {
      const vi = i0 + k;
      const key = positionBucketKey(positions.getX(vi), positions.getY(vi), positions.getZ(vi));
      const list = buckets.get(key);
      if (list) {
        list.push(f);
      } else {
        buckets.set(key, [f]);
      }
    }
  }

  const normals = new Float32Array(vertexCount * 3);
  for (let f = 0; f < faceCount; f++) {
    const fx = faceNormals[f * 3]!;
    const fy = faceNormals[f * 3 + 1]!;
    const fz = faceNormals[f * 3 + 2]!;
    const i0 = f * 3;

    for (let k = 0; k < 3; k++) {
      const vi = i0 + k;
      const key = positionBucketKey(positions.getX(vi), positions.getY(vi), positions.getZ(vi));
      const adjacentFaces = buckets.get(key)!;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const other of adjacentFaces) {
        const ox = faceNormals[other * 3]!;
        const oy = faceNormals[other * 3 + 1]!;
        const oz = faceNormals[other * 3 + 2]!;
        if (fx * ox + fy * oy + fz * oz >= cosThreshold) {
          sx += ox;
          sy += oy;
          sz += oz;
        }
      }
      const lenSq = sx * sx + sy * sy + sz * sz;
      if (lenSq > MIN_NORMAL_LENGTH_SQ) {
        const inv = 1 / Math.sqrt(lenSq);
        normals[vi * 3] = sx * inv;
        normals[vi * 3 + 1] = sy * inv;
        normals[vi * 3 + 2] = sz * inv;
      } else {
        normals[vi * 3] = fx;
        normals[vi * 3 + 1] = fy;
        normals[vi * 3 + 2] = fz;
      }
    }
  }

  flat.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  const indexed = mergeVertices(flat, 1e-6);
  flat.dispose();
  indexed.computeBoundingBox();
  indexed.computeBoundingSphere();
  return indexed;
}

function positionBucketKey(x: number, y: number, z: number): string {
  return `${Math.round(x * QUANTIZE_SCALE)},${Math.round(y * QUANTIZE_SCALE)},${Math.round(z * QUANTIZE_SCALE)}`;
}
