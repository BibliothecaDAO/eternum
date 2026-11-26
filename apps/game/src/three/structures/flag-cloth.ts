import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { type FlagAnchor, requireFlagAnchors } from "./flag-anchors";
import { REALM_BANNER_TILE } from "./settlement-appearance";

const BANNER_ASPECT = REALM_BANNER_TILE.height / REALM_BANNER_TILE.width;

export function withFlagCloth(gltf: GLTF): GLTF {
  const scene = gltf.scene;
  if (scene.userData.flagClothAttached) return gltf;
  scene.userData.flagClothAttached = true;
  const anchors = readFlagAnchors(scene);
  if (anchors.length > 0) scene.add(bannersAt(anchors));
  return gltf;
}

function readFlagAnchors(scene: Object3D): FlagAnchor[] {
  const anchors: FlagAnchor[] = [];
  scene.traverse((node) => {
    if (node.userData.flagAnchors !== undefined)
      anchors.push(...requireFlagAnchors(node.userData.flagAnchors, `${node.name || "a realm model"}'s flag anchors`));
  });
  return anchors;
}

function bannersAt(anchors: readonly FlagAnchor[]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const { top, width, facing } of anchors) {
    const angle = (facing * Math.PI) / 180;
    const across = [Math.cos(angle), 0, -Math.sin(angle)];
    const normal = [Math.sin(angle), 0, Math.cos(angle)];
    const height = width * BANNER_ASPECT;
    const first = positions.length / 3;
    for (const [side, drop, u, v] of [
      [-1, 0, 0, 0],
      [1, 0, 1, 0],
      [1, 1, 1, 1],
      [-1, 1, 0, 1],
    ] as const) {
      positions.push(
        top[0] + (across[0] * side * width) / 2,
        top[1] - drop * height,
        top[2] + (across[2] * side * width) / 2,
      );
      normals.push(...normal);
      uvs.push(u, v);
    }
    indices.push(first, first + 3, first + 1, first + 1, first + 3, first + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const cloth = new Mesh(geometry, new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, side: DoubleSide }));
  cloth.name = "Realm banner cloth";
  cloth.userData.orderCloth = "banner";
  return cloth;
}
