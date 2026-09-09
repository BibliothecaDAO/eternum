import { createOwnershipSailMaterial } from "../characters/ships/ship-sail-material";
import { type Material, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { MaterialPool } from "../utils/material-pool";

const materialPool = MaterialPool.getInstance();

function poolSingleMaterial(sourceMaterial: Material): Material {
  if (
    sourceMaterial.userData.ownershipColor === true &&
    (sourceMaterial instanceof MeshStandardMaterial || sourceMaterial instanceof MeshBasicMaterial)
  ) {
    return createOwnershipSailMaterial(sourceMaterial);
  }
  if (sourceMaterial instanceof MeshStandardMaterial) {
    const overrides = sourceMaterial.name?.includes("stand") ? { opacity: 0.9 } : {};
    return materialPool.getBasicMaterial(sourceMaterial, overrides);
  }

  if (sourceMaterial instanceof MeshBasicMaterial) {
    return materialPool.getBasicMaterial(sourceMaterial);
  }

  return sourceMaterial;
}

function usesOwnershipColor(material: Material): boolean {
  return material.userData.ownershipColor === true || material.name?.includes("stand");
}

export function createPooledInstancedMaterial(sourceMaterial: Material | Material[]): {
  material: Material | Material[];
  usesInstanceColor: boolean;
} {
  const sourceMaterials = Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial];
  const pooledMaterials = sourceMaterials.map((material) => poolSingleMaterial(material));
  const usesInstanceColor = sourceMaterials.some(usesOwnershipColor);

  return {
    material: Array.isArray(sourceMaterial) ? pooledMaterials : pooledMaterials[0],
    usesInstanceColor,
  };
}

export function releasePooledInstancedMaterial(material: Material | Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((entry) => {
    if (entry.userData.ownershipColor === true) entry.dispose();
    else materialPool.releaseMaterial(entry);
  });
}
