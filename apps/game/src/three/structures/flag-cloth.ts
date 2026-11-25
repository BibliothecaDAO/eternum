import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

type FlagRole = "banner" | "trim";

interface FlagAnchor {
  role: FlagRole;
  position: readonly [number, number, number];
  size: readonly [number, number];
  facing: number;
}

const ROLES: readonly FlagRole[] = ["banner", "trim"];

export function withFlagCloth(gltf: GLTF): GLTF {
  const scene = gltf.scene;
  if (scene.userData.flagClothAttached) return gltf;
  scene.userData.flagClothAttached = true;
  const anchors = readFlagAnchors(scene);
  for (const role of ROLES) {
    const placed = anchors.filter((anchor) => anchor.role === role);
    if (placed.length > 0) scene.add(clothFor(role, placed));
  }
  return gltf;
}

function readFlagAnchors(scene: Object3D): FlagAnchor[] {
  const anchors: FlagAnchor[] = [];
  scene.traverse((node) => {
    const listed = node.userData.flagAnchors;
    if (Array.isArray(listed)) anchors.push(...(listed as FlagAnchor[]));
  });
  return anchors;
}

function clothFor(role: FlagRole, anchors: readonly FlagAnchor[]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const { position, size, facing } of anchors) {
    const angle = (facing * Math.PI) / 180;
    const across = [Math.cos(angle), 0, -Math.sin(angle)];
    const normal = [Math.sin(angle), 0, Math.cos(angle)];
    const [halfWidth, halfHeight] = [size[0] / 2, size[1] / 2];
    const first = positions.length / 3;
    for (const [side, up, u, v] of [
      [-1, 1, 0, 0],
      [1, 1, 1, 0],
      [1, -1, 1, 1],
      [-1, -1, 0, 1],
    ] as const) {
      positions.push(
        position[0] + across[0] * side * halfWidth,
        position[1] + up * halfHeight,
        position[2] + across[2] * side * halfWidth,
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
  cloth.name = `Realm flag cloth (${role})`;
  cloth.userData.orderCloth = role;
  return cloth;
}
