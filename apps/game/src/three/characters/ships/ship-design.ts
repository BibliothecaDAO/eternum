import { Float32BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Texture } from "three";

export type ShipArmyClass = "knight" | "crossbowman" | "paladin";
export type ShipTier = 1 | 2 | 3;
/** Authored hulls span several hexes; this is the one scale that fits them to a tile in the world and the lab. */
export const SHIP_WORLD_SCALE = 0.3;
const HULL_LENGTH = 4.2;
const NAMES: Record<ShipArmyClass, readonly string[]> = {
  knight: ["Warden transport", "Ironwind escort", "Sovereign flagship"],
  crossbowman: ["Ranger transport", "Arbalest clipper", "Tempest flagship"],
  paladin: ["Dawn pilgrim", "Celestial caravel", "Dragon sovereign"],
};

export interface ShipDesign {
  readonly object: Group;
  readonly name: string;
  readonly length: number;
  readonly triangles: number;
  /** The owner retains ownership of the shared print texture. */
  setSailPrint(texture: Texture | null, playerColor: string): void;
  setWind(strength: number): void;
  animate(seconds: number, sailing: boolean): void;
  setWireframe(enabled: boolean): void;
  dispose(): void;
}

interface ClothMesh {
  geometry: BufferGeometry;
  rest: Float32Array;
  pennant: boolean;
  uv: Float32Array;
  mast: { baseHeight: number; topHeight: number; baseZ: number; topZ: number; radius: number } | null;
}

/** Distinct authored hulls share a common length, beam envelope and game scale. */
export function createShipDesign(template: Group, army: ShipArmyClass, tier: ShipTier): ShipDesign {
  const object = new Group();
  object.name = `ship-${army}-t${tier}`;
  object.scale.setScalar(SHIP_WORLD_SCALE);
  const hull = template.clone(true);
  object.add(hull);
  const meshes = prepareShipMeshes(hull);
  let wind = 1;
  let disposed = false;
  const animate = (seconds: number, sailing: boolean) => {
    const phase = (seconds * Math.PI * 2) / 6;
    animateHull(hull, phase, sailing, wind);
    animateCloth(meshes.cloth, phase, sailing, wind);
  };
  animate(0, false);
  return {
    object,
    name: NAMES[army][tier - 1],
    length: HULL_LENGTH * SHIP_WORLD_SCALE,
    triangles: meshes.triangles,
    animate,
    setWind: (strength) => {
      if (!Number.isFinite(strength) || strength < 0 || strength > 2) throw new Error("Wind must be between 0 and 2");
      wind = strength;
    },
    setSailPrint: (texture, color) => applySailPrint(meshes, texture, color),
    setWireframe: (enabled) => meshes.materials.forEach((material) => (material.wireframe = enabled)),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      hull.traverse((node) => {
        if (node instanceof Mesh) node.geometry.dispose();
      });
      meshes.materials.forEach((material) => material.dispose());
      object.removeFromParent();
    },
  };
}

function prepareShipMeshes(hull: Group) {
  const materials = new Set<MeshStandardMaterial>();
  const sails = new Set<MeshStandardMaterial>();
  const pennants = new Set<MeshStandardMaterial>();
  const cloth: ClothMesh[] = [];
  let triangles = 0;
  hull.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry = node.geometry.clone();
    node.castShadow = true;
    node.receiveShadow = true;
    const copies = (Array.isArray(node.material) ? node.material : [node.material]).map((source) => {
      const copy = source.clone() as MeshStandardMaterial;
      materials.add(copy);
      return copy;
    });
    node.material = Array.isArray(node.material) ? copies : copies[0];
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    const kind = clothKind(node);
    if (!kind) return;
    const uv = node.geometry.attributes.uv;
    if (!uv || uv.count !== node.geometry.attributes.position.count)
      throw new Error(`Fleet cloth ${node.name} has no valid UVs`);
    copies.forEach((material) => (kind === "sail" ? sails : pennants).add(material));
    const attributes = prepareClothAttributes(node.geometry);
    cloth.push({
      geometry: node.geometry,
      ...attributes,
      pennant: kind === "pennant",
      mast: kind === "sail" ? readClothMast(node) : null,
    });
    node.geometry.computeBoundingSphere();
    if (node.geometry.boundingSphere) node.geometry.boundingSphere.radius += 0.8;
  });
  return { materials, sails, pennants, cloth, triangles };
}

/** Asset compression can interleave attributes; cloth needs independent writable positions. */
function prepareClothAttributes(geometry: BufferGeometry): Pick<ClothMesh, "rest" | "uv"> {
  const position = geometry.attributes.position;
  const coordinates = geometry.attributes.uv;
  const rest = new Float32Array(position.count * 3);
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index++) {
    rest.set([position.getX(index), position.getY(index), position.getZ(index)], index * 3);
    uv.set([coordinates.getX(index), coordinates.getY(index)], index * 2);
  }
  geometry.setAttribute("position", new Float32BufferAttribute(rest.slice(), 3));
  return { rest, uv };
}

function readClothMast(node: Mesh): NonNullable<ClothMesh["mast"]> {
  const { clothMastStart: start, clothMastEnd: end, clothMastRadius: radius } = node.userData;
  if (
    !Array.isArray(start) ||
    !Array.isArray(end) ||
    start.length !== 3 ||
    end.length !== 3 ||
    ![...start, ...end, radius].every(Number.isFinite) ||
    radius <= 0 ||
    end[1] <= start[1]
  ) {
    throw new Error(`Fleet sail ${node.name} has no valid mast clearance geometry`);
  }
  return { baseHeight: start[1], topHeight: end[1], baseZ: start[2], topZ: end[2], radius };
}

function applySailPrint(meshes: ReturnType<typeof prepareShipMeshes>, texture: Texture | null, color: string) {
  for (const sail of meshes.sails) {
    sail.map = texture;
    sail.color.set(texture ? "#ffffff" : "#e5d7b8");
    sail.needsUpdate = true;
  }
  for (const pennant of meshes.pennants) pennant.color.set(color);
}

function clothKind(node: Object3D): "sail" | "pennant" | null {
  if (node.name.startsWith("Sail_")) return "sail";
  if (node.name.startsWith("Pennant_")) return "pennant";
  return null;
}

function animateHull(hull: Group, phase: number, sailing: boolean, wind: number) {
  const amplitude = (sailing ? 0.026 : 0.012) * wind;
  hull.position.y = Math.sin(phase * 2) * amplitude;
  hull.rotation.z = Math.sin(phase) * amplitude * 0.85;
  hull.rotation.x = Math.sin(phase * 2 + 0.4) * amplitude * 0.5;
}

function animateCloth(cloth: ClothMesh[], phase: number, sailing: boolean, wind: number) {
  const pressure = (sailing ? 0.32 : 0.17) * wind;
  for (const { geometry, rest, uv, pennant, mast } of cloth) {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = rest[i * 3],
        y = rest[i * 3 + 1],
        z = rest[i * 3 + 2];
      let offset: number;
      if (pennant) {
        const along = uv[i * 2];
        offset = (Math.sin(phase * 4 - along * 9) * 0.2 + Math.sin(phase * 7 - along * 14) * 0.055) * along * wind;
      } else {
        const down = uv[i * 2 + 1];
        const across = Math.abs(uv[i * 2] * 2 - 1);
        const belly = Math.sin(down * Math.PI) * (1 - across * across);
        const gust = 0.6 + 0.4 * Math.sin(phase * 2 + z * 1.7);
        const ripple = (0.5 + 0.5 * Math.sin(phase * 4 - down * 7 + x * 4)) * down * down * (1 - across * across);
        // The head and corner attachments stay pinned while the belly fills and the foot ripples.
        offset = -pressure * (belly * gust + ripple * 0.35);
      }
      // Wind fills the sail forward (-Z). Keep a clearance plane even if a future wave changes sign.
      const mastSlope = mast ? (mast.topZ - mast.baseZ) / (mast.topHeight - mast.baseHeight) : 0;
      const limit = mast
        ? mast.baseZ + (y - mast.baseHeight) * mastSlope - mast.radius * Math.hypot(1, mastSlope) - 0.015
        : Infinity;
      positions.setZ(i, Math.min(z + offset, limit));
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }
}
