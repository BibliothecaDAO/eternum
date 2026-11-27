import { type BufferGeometry, Group, Mesh, Object3D, Texture, type Material } from "three";
import {
  SHIP_CLOTH_PARAMS,
  SHIP_WORLD_SCALE,
  createProceduralPennantMaterial,
  createProceduralSailMaterial,
  createShipClothUniforms,
  type ShipClothUniforms,
} from "./ship-sail-material";

export { SHIP_WORLD_SCALE };
export type ShipArmyClass = "knight" | "crossbowman" | "paladin";
export type ShipTier = 1 | 2 | 3;
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
  setSailPrint(texture: Texture | null, playerColor: string): void;
  setWind(strength: number): void;
  animate(seconds: number, sailing: boolean): void;
  setWireframe(enabled: boolean): void;
  dispose(): void;
}

export function bakeShipWorldScale(scene: Object3D): void {
  const scaled = new Set<BufferGeometry>();
  scene.traverse((child) => {
    if (!(child instanceof Mesh) || scaled.has(child.geometry)) return;
    child.geometry.rotateY(Math.PI);
    child.geometry.scale(SHIP_WORLD_SCALE, SHIP_WORLD_SCALE, SHIP_WORLD_SCALE);
    scaled.add(child.geometry);
  });
}

export function createShipDesign(template: Group, army: ShipArmyClass, tier: ShipTier): ShipDesign {
  const object = new Group();
  object.name = `ship-${army}-t${tier}`;
  object.scale.setScalar(SHIP_WORLD_SCALE);
  const hull = template.clone(true);
  object.add(hull);
  const clothUniforms = createShipClothUniforms();
  const meshes = prepareShipMeshes(hull, clothUniforms);
  let wind = 1;
  let disposed = false;

  const animate = (seconds: number, sailing: boolean) => {
    const phase = (seconds * Math.PI * 2) / SHIP_CLOTH_PARAMS.cycleSeconds;
    clothUniforms.phase.value = phase;
    clothUniforms.wind.value = wind;
    clothUniforms.sailing.value = sailing ? 1 : 0;
    animateHull(hull, phase, sailing, wind);
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
      clothUniforms.wind.value = strength;
    },
    setSailPrint: (texture, color) => {
      for (const setPrint of meshes.sailPrintSetters) setPrint(texture);
      for (const setTint of meshes.pennantTintSetters) setTint(color);
    },
    setWireframe: (enabled) => {
      for (const material of meshes.materials) {
        if ("wireframe" in material) (material as Material & { wireframe: boolean }).wireframe = enabled;
      }
    },
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

function prepareShipMeshes(hull: Group, clothUniforms: ShipClothUniforms) {
  const materials = new Set<Material>();
  const sailPrintSetters: Array<(texture: Texture | null) => void> = [];
  const pennantTintSetters: Array<(hex: string) => void> = [];
  let triangles = 0;

  hull.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry = node.geometry.clone();
    node.castShadow = true;
    node.receiveShadow = true;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;

    const kind = clothKind(node);
    if (kind === "sail") {
      const uv = node.geometry.attributes.uv;
      if (!uv || uv.count !== node.geometry.attributes.position.count) {
        throw new Error(`Fleet cloth ${node.name} has no valid UVs`);
      }
      if (!node.geometry.attributes.aMastClearanceZ) {
        throw new Error(`Fleet sail ${node.name} has no mast clearance attribute`);
      }
      const initialMap =
        !Array.isArray(node.material) && "map" in node.material
          ? ((node.material.map as Texture | null) ?? null)
          : null;
      const { material, setPrint } = createProceduralSailMaterial(clothUniforms, initialMap);
      node.material = material;
      materials.add(material);
      sailPrintSetters.push(setPrint);
      return;
    }

    if (kind === "pennant") {
      const uv = node.geometry.attributes.uv;
      if (!uv || uv.count !== node.geometry.attributes.position.count) {
        throw new Error(`Fleet cloth ${node.name} has no valid UVs`);
      }
      const initialColor =
        !Array.isArray(node.material) && "color" in node.material && node.material.color
          ? `#${(node.material.color as { getHexString(): string }).getHexString()}`
          : undefined;
      const { material, setTint } = createProceduralPennantMaterial(clothUniforms, initialColor);
      node.material = material;
      materials.add(material);
      pennantTintSetters.push(setTint);
      return;
    }

    const copies = (Array.isArray(node.material) ? node.material : [node.material]).map((source) => {
      const copy = source.clone();
      materials.add(copy);
      return copy;
    });
    node.material = Array.isArray(node.material) ? copies : copies[0];
  });

  return { materials, sailPrintSetters, pennantTintSetters, triangles };
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
