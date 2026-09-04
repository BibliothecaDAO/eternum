import { type Material, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { MaterialPool } from "../utils/material-pool";

const materialPool = MaterialPool.getInstance();

function poolSingleMaterial(sourceMaterial: Material): Material {
  if (sourceMaterial instanceof MeshStandardMaterial) {
    const overrides = sourceMaterial.name?.includes("stand") ? { opacity: 0.9 } : {};
    return materialPool.getBasicMaterial(sourceMaterial, overrides);
  }

  if (sourceMaterial instanceof MeshBasicMaterial) {
    return materialPool.getBasicMaterial(sourceMaterial);
  }

  return sourceMaterial;
}

export function createPooledInstancedMaterial(sourceMaterial: Material | Material[]): {
  material: Material | Material[];
  usesInstanceColor: boolean;
} {
  const sourceMaterials = Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial];
  const pooledMaterials = sourceMaterials.map((material) => poolSingleMaterial(material));
  const usesInstanceColor = sourceMaterials.some((material) => material.name?.includes("stand"));

  return {
    material: Array.isArray(sourceMaterial) ? pooledMaterials : pooledMaterials[0],
    usesInstanceColor,
  };
}

export function releasePooledInstancedMaterial(material: Material | Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((entry) => materialPool.releaseMaterial(entry));
}
