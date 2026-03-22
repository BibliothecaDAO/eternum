/**
 * MaterialPool - Shared material management for ThreeJS applications
 *
 * Prevents duplicate materials by sharing based on key properties:
 * - Texture URL
 * - Transparency settings
 * - Material properties (opacity, side, etc.)
 */

import { Material, MeshBasicMaterial, MeshStandardMaterial, Side } from "three";

interface MaterialKey {
  textureUrl: string;
  transparent: boolean;
  side: Side;
  opacity: number;
  alphaTest?: number;
  depthTest?: boolean;
  depthWrite?: boolean;
  materialType: "basic" | "standard";
  color?: number;
  emissive?: number;
  metalness?: number;
  roughness?: number;
  vertexColors?: boolean;
}

interface MaterialStats {
  uniqueMaterials: number;
  totalReferences: number;
  memoryEstimateMB: number;
  materialTypes: Record<string, number>;
}

export class MaterialPool {
  private static instance: MaterialPool;
  private materials: Map<string, Material> = new Map();
  private referenceCount: Map<string, number> = new Map();
  private materialKeys: Map<Material, string> = new Map();

  private constructor() {}

  public static getInstance(): MaterialPool {
    if (!MaterialPool.instance) {
      MaterialPool.instance = new MaterialPool();
    }
    return MaterialPool.instance;
  }

  /**
   * Generate a unique key for material properties
   */
  private generateMaterialKey(sourceMaterial: Material, overrides?: Partial<MaterialKey>): string {
    const sourceMap = (sourceMaterial as any).map;
    const textureUrl =
      sourceMap?.image?.src || sourceMap?.source?.data?.src || sourceMap?.uuid || sourceMap?.name || "none";

    const key: MaterialKey = {
      textureUrl,
      transparent: overrides?.transparent ?? sourceMaterial.transparent,
      side: sourceMaterial.side,
      opacity: overrides?.opacity ?? sourceMaterial.opacity,
      alphaTest: (sourceMaterial as any).alphaTest,
      depthTest: sourceMaterial.depthTest,
      depthWrite: sourceMaterial.depthWrite,
      materialType: overrides?.materialType ?? "basic",
      color: overrides?.color ?? (sourceMaterial as any).color?.getHex(),
      emissive: (sourceMaterial as any).emissive?.getHex?.(),
      metalness: overrides?.metalness ?? (sourceMaterial as any).metalness,
      roughness: overrides?.roughness ?? (sourceMaterial as any).roughness,
      vertexColors: (sourceMaterial as any).vertexColors,
    };

    return JSON.stringify(key);
  }

  /**
   * Get or create a shared MeshBasicMaterial
   */
  public getBasicMaterial(
    sourceMaterial: Material,
    overrides?: {
      opacity?: number;
      color?: number;
      transparent?: boolean;
    },
  ): MeshBasicMaterial {
    const materialOverrides = {
      materialType: "basic" as const,
      ...overrides,
    };
    const key = this.generateMaterialKey(sourceMaterial, materialOverrides);

    if (this.materials.has(key)) {
      const material = this.materials.get(key) as MeshBasicMaterial;
      this.referenceCount.set(key, (this.referenceCount.get(key) || 0) + 1);
      return material;
    }

    // Create new shared material
    const sourceAsStandard = sourceMaterial as MeshStandardMaterial;
    const newMaterial = new MeshBasicMaterial({
      map: sourceAsStandard.map,
      transparent: overrides?.transparent ?? sourceMaterial.transparent,
      side: sourceMaterial.side,
      opacity: overrides?.opacity ?? sourceMaterial.opacity,
      color: overrides?.color ?? sourceAsStandard.color,
      alphaTest: sourceMaterial.alphaTest,
      depthTest: sourceMaterial.depthTest,
      depthWrite: sourceMaterial.depthWrite,
      vertexColors: sourceAsStandard.vertexColors,
    });

    // Store references
    this.materials.set(key, newMaterial);
    this.referenceCount.set(key, 1);
    this.materialKeys.set(newMaterial, key);

    return newMaterial;
  }

  /**
   * Get or create a shared MeshStandardMaterial
   */
  public getStandardMaterial(
    sourceMaterial: Material,
    overrides?: {
      opacity?: number;
      color?: number;
      metalness?: number;
      roughness?: number;
      transparent?: boolean;
    },
  ): MeshStandardMaterial {
    const materialOverrides = {
      materialType: "standard" as const,
      ...overrides,
    };
    const key = this.generateMaterialKey(sourceMaterial, materialOverrides);

    if (this.materials.has(key)) {
      const material = this.materials.get(key) as MeshStandardMaterial;
      this.referenceCount.set(key, (this.referenceCount.get(key) || 0) + 1);
      return material;
    }

    // Create new shared material
    const sourceAsStandard = sourceMaterial as MeshStandardMaterial;
    const newMaterial = new MeshStandardMaterial({
      map: sourceAsStandard.map,
      transparent: overrides?.transparent ?? sourceMaterial.transparent,
      side: sourceMaterial.side,
      opacity: overrides?.opacity ?? sourceMaterial.opacity,
      color: overrides?.color ?? sourceAsStandard.color,
      emissive: sourceAsStandard.emissive,
      metalness: overrides?.metalness ?? sourceAsStandard.metalness,
      roughness: overrides?.roughness ?? sourceAsStandard.roughness,
      alphaTest: sourceMaterial.alphaTest,
      depthTest: sourceMaterial.depthTest,
      depthWrite: sourceMaterial.depthWrite,
      vertexColors: sourceAsStandard.vertexColors,
    });

    // Store references
    this.materials.set(key, newMaterial);
    this.referenceCount.set(key, 1);
    this.materialKeys.set(newMaterial, key);

    return newMaterial;
  }

  /**
   * Release a material reference (decrements reference count)
   */
  public releaseMaterial(material: Material): void {
    const key = this.materialKeys.get(material);
    if (!key) {
      console.warn("MaterialPool: Attempting to release material not managed by pool");
      return;
    }

    const count = this.referenceCount.get(key) || 0;
    if (count <= 1) {
      // Last reference, dispose and cleanup
      material.dispose();
      this.materials.delete(key);
      this.referenceCount.delete(key);
      this.materialKeys.delete(material);
    } else {
      // Decrement reference count
      this.referenceCount.set(key, count - 1);
    }
  }

  /**
   * Get statistics about material sharing
   */
  public getStats(): MaterialStats {
    const totalReferences = Array.from(this.referenceCount.values()).reduce((a, b) => a + b, 0);
    const materialTypes: Record<string, number> = {};

    // Count by material type
    this.materials.forEach((material, key) => {
      const keyObj = JSON.parse(key) as MaterialKey;
      materialTypes[keyObj.materialType] = (materialTypes[keyObj.materialType] || 0) + 1;
    });

    return {
      uniqueMaterials: this.materials.size,
      totalReferences,
      memoryEstimateMB: Math.round(this.materials.size * 0.005 * 100) / 100, // ~5KB per material
      materialTypes,
    };
  }

  /**
   * Clear all materials (for cleanup)
   */
  public dispose(): void {
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
    this.referenceCount.clear();
    this.materialKeys.clear();
  }

  /**
   * Log sharing efficiency for debugging
   */
  public logSharingStats(): void {
    const stats = this.getStats();
    const sharingRatio = stats.totalReferences / Math.max(stats.uniqueMaterials, 1);

    console.log(`🎨 MaterialPool Stats:
      • Unique Materials: ${stats.uniqueMaterials}
      • Total References: ${stats.totalReferences}
      • Sharing Ratio: ${sharingRatio.toFixed(1)}:1
      • Memory Estimate: ${stats.memoryEstimateMB}MB
      • Types: ${Object.entries(stats.materialTypes)
        .map(([type, count]) => `${type}:${count}`)
        .join(", ")}`);
  }
}
