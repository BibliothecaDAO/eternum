/**
 * HexGeometryPool - Shared geometry manager for hex-based objects
 *
 * Prevents memory waste by sharing identical hex geometries across all managers.
 * Uses singleton pattern with reference counting for safe disposal.
 */

import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape, createRoundedHexagonShape } from "@/three/geometry/hexagon-geometry";
import { ShapeGeometry } from "three";

interface GeometryConfig {
  size: number;
  rounded: boolean;
  cornerRadius?: number;
}

interface GeometryStats {
  totalGeometries: number;
  totalReferences: number;
  memoryEstimateMB: number;
  sharingRatio: number;
}

export class HexGeometryPool {
  private static instance: HexGeometryPool;

  // Cache for shared geometries
  private geometries: Map<string, ShapeGeometry> = new Map();

  // Reference counting for safe disposal
  private referenceCount: Map<string, number> = new Map();

  // Geometry configurations for different hex types
  private static readonly GEOMETRY_CONFIGS: Record<string, GeometryConfig> = {
    standard: {
      size: HEX_SIZE,
      rounded: false,
    },
    highlight: {
      size: HEX_SIZE * 0.975,
      rounded: true,
      cornerRadius: HEX_SIZE * 0.975 * 0.15,
    },
    interactive: {
      size: HEX_SIZE,
      rounded: false,
    },
    border: {
      size: HEX_SIZE,
      rounded: false,
    },
  };

  private constructor() {}

  public static getInstance(): HexGeometryPool {
    if (!HexGeometryPool.instance) {
      HexGeometryPool.instance = new HexGeometryPool();
    }
    return HexGeometryPool.instance;
  }

  /**
   * Get or create a shared hex geometry
   */
  public getGeometry(type: string): ShapeGeometry {
    const config = HexGeometryPool.GEOMETRY_CONFIGS[type];
    if (!config) {
      throw new Error(`Unknown hex geometry type: ${type}`);
    }

    // Return existing geometry if already created
    if (this.geometries.has(type)) {
      this.incrementReference(type);
      return this.geometries.get(type)!;
    }

    // Create new shared geometry
    const geometry = this.createGeometry(config);
    this.geometries.set(type, geometry);
    this.incrementReference(type);

    return geometry;
  }

  /**
   * Release a reference to a shared geometry
   */
  public releaseGeometry(type: string): void {
    if (!this.geometries.has(type)) {
      console.warn(`HexGeometryPool: Trying to release unknown geometry type: ${type}`);
      return;
    }

    this.decrementReference(type);

    // If no more references, dispose the geometry
    if (this.referenceCount.get(type) === 0) {
      const geometry = this.geometries.get(type)!;
      geometry.dispose();
      this.geometries.delete(type);
      this.referenceCount.delete(type);

      console.log(`🗑️  Disposed unused hex geometry: ${type}`);
    }
  }

  /**
   * Create optimized geometry from config
   */
  private createGeometry(config: GeometryConfig): ShapeGeometry {
    const shape = config.rounded
      ? createRoundedHexagonShape(config.size, config.cornerRadius)
      : createHexagonShape(config.size);

    const geometry = new ShapeGeometry(shape);

    // Optimize geometry for sharing
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
  }

  /**
   * Reference counting helpers
   */
  private incrementReference(type: string): void {
    const currentCount = this.referenceCount.get(type) || 0;
    this.referenceCount.set(type, currentCount + 1);
  }

  private decrementReference(type: string): void {
    const currentCount = this.referenceCount.get(type) || 0;
    this.referenceCount.set(type, Math.max(0, currentCount - 1));
  }

  /**
   * Get sharing statistics
   */
  public getStats(): GeometryStats {
    const totalGeometries = this.geometries.size;
    const totalReferences = Array.from(this.referenceCount.values()).reduce((sum, count) => sum + count, 0);
    const sharingRatio = totalReferences / Math.max(totalGeometries, 1);

    // Estimate memory usage (rough calculation)
    let memoryEstimate = 0;
    this.geometries.forEach((geometry) => {
      const vertices = geometry.attributes.position?.count || 0;
      memoryEstimate += vertices * 3 * 4; // 3 coords * 4 bytes per float
    });

    return {
      totalGeometries,
      totalReferences,
      memoryEstimateMB: memoryEstimate / (1024 * 1024),
      sharingRatio,
    };
  }

  /**
   * Get total reference count across all geometries
   */
  private getTotalReferences(): number {
    return Array.from(this.referenceCount.values()).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Calculate theoretical memory saved by sharing
   */
  private getMemorySaved(): number {
    const stats = this.getStats();
    const theoreticalWaste = stats.totalReferences - stats.totalGeometries;
    return theoreticalWaste * 3; // Rough estimate: 3KB per geometry
  }

  /**
   * Debug method to log sharing effectiveness
   */
  public logSharingStats(): void {
    const stats = this.getStats();
    const memorySaved = this.getMemorySaved();

    console.log(`
🔷 HEX GEOMETRY SHARING STATS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Shared Geometries: ${stats.totalGeometries}
🔗 Total References: ${stats.totalReferences}
♻️  Sharing Ratio: ${stats.sharingRatio.toFixed(1)}:1
💾 Memory Used: ${stats.memoryEstimateMB.toFixed(2)}MB
💰 Memory Saved: ~${memorySaved}KB
${
  stats.sharingRatio > 5
    ? "✅ EXCELLENT sharing efficiency!"
    : stats.sharingRatio > 2
      ? "✅ GOOD sharing efficiency"
      : "⚠️  Low sharing - check for geometry duplication"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // Log breakdown by geometry type
    this.geometries.forEach((geometry, type) => {
      const references = this.referenceCount.get(type) || 0;
      console.log(`  • ${type}: ${references} references`);
    });
  }

  /**
   * Get available geometry types
   */
  public getAvailableTypes(): string[] {
    return Object.keys(HexGeometryPool.GEOMETRY_CONFIGS);
  }

  /**
   * Dispose all geometries (for cleanup)
   */
  public dispose(): void {
    console.log(`🗑️  Disposing HexGeometryPool with ${this.geometries.size} shared geometries`);

    this.geometries.forEach((geometry, type) => {
      geometry.dispose();
      console.log(`  • Disposed ${type} geometry`);
    });

    this.geometries.clear();
    this.referenceCount.clear();
  }
}

// Global debug functions for development
(window as any).logHexGeometrySharing = () => HexGeometryPool.getInstance().logSharingStats();
(window as any).getHexGeometryTypes = () => HexGeometryPool.getInstance().getAvailableTypes();
