import { createOwnershipPennantMaterial, createOwnershipSailMaterial } from "../characters/ships/ship-sail-material";
import { type Material, MeshBasicMaterial, MeshStandardMaterial } from "three";
import {
  createTripoModelMaterial,
  isTripoModelMaterial,
  isTripoTroopMaterial,
} from "../materials/tripo-model-material";
import { isProcgenMasonryMaterial } from "../structures/procgen-masonry-material";
import { MaterialPool } from "../utils/material-pool";

const materialPool = MaterialPool.getInstance();

function poolSingleMaterial(sourceMaterial: Material): Material {
  if (
    sourceMaterial.userData.ownershipColor === true &&
    (sourceMaterial instanceof MeshStandardMaterial || sourceMaterial instanceof MeshBasicMaterial)
  ) {
    if (sourceMaterial.userData.shipCloth === "pennant") {
      return createOwnershipPennantMaterial(sourceMaterial);
    }
    return createOwnershipSailMaterial(sourceMaterial);
  }
  if (isTripoModelMaterial(sourceMaterial) && sourceMaterial instanceof MeshStandardMaterial) {
    return createTripoModelMaterial(sourceMaterial);
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
  return (
    material.userData.ownershipColor === true || isTripoTroopMaterial(material) || material.name?.includes("stand")
  );
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
    if (entry.userData.ownershipColor === true || isTripoModelMaterial(entry) || isProcgenMasonryMaterial(entry)) {
      entry.dispose();
    } else {
      materialPool.releaseMaterial(entry);
    }
  });
}
