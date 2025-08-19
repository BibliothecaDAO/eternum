/**
 * Debug utility to track hex geometry creation and measure memory impact
 */

import { HexGeometryPool } from "./hex-geometry-pool";

class HexGeometryDebugger {
  private static instance: HexGeometryDebugger;
  private geometryCreationCount = 0;
  private materialCloneCount = 0;
  private sharedGeometryUsageCount = 0;
  private startTime = Date.now();

  public static getInstance(): HexGeometryDebugger {
    if (!HexGeometryDebugger.instance) {
      HexGeometryDebugger.instance = new HexGeometryDebugger();
    }
    return HexGeometryDebugger.instance;
  }

  public trackGeometryCreation(source: string): void {
    this.geometryCreationCount++;
    console.log(`🔶 Hex Geometry Created #${this.geometryCreationCount} from ${source}`);

    // Log summary every 10 creations
    if (this.geometryCreationCount % 10 === 0) {
      this.logSummary();
    }
  }

  public trackMaterialClone(source: string): void {
    this.materialCloneCount++;
    console.log(`🔸 Material Cloned #${this.materialCloneCount} from ${source}`);
  }

  public trackSharedGeometryUsage(type: string, source: string): void {
    this.sharedGeometryUsageCount++;
    console.log(`♻️  Shared Geometry Used #${this.sharedGeometryUsageCount}: ${type} from ${source}`);

    // Log sharing summary every 10 usages
    if (this.sharedGeometryUsageCount % 10 === 0) {
      HexGeometryPool.getInstance().logSharingStats();
    }
  }

  public logSummary(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const geometryRate = this.geometryCreationCount / elapsed;
    const materialRate = this.materialCloneCount / elapsed;
    const sharingRate = this.sharedGeometryUsageCount / elapsed;
    const sharingEfficiency = this.sharedGeometryUsageCount / Math.max(this.geometryCreationCount, 1);

    console.log(`
📊 HEX GEOMETRY MEMORY IMPACT SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Geometries Created: ${this.geometryCreationCount}
🎨 Materials Cloned: ${this.materialCloneCount}
♻️  Shared Geometry Uses: ${this.sharedGeometryUsageCount}
⏱️  Session Time: ${elapsed.toFixed(1)}s
📈 Geometry Rate: ${geometryRate.toFixed(2)}/sec
📈 Material Rate: ${materialRate.toFixed(2)}/sec
📈 Sharing Rate: ${sharingRate.toFixed(2)}/sec
🎯 Sharing Efficiency: ${sharingEfficiency.toFixed(1)}:1
💾 Est. Memory Waste: ~${(this.geometryCreationCount * 3 + this.materialCloneCount * 1.5).toFixed(1)}KB
💰 Est. Memory Saved: ~${((this.sharedGeometryUsageCount - this.geometryCreationCount) * 3).toFixed(1)}KB
${
  sharingEfficiency > 5
    ? "🌟 EXCELLENT memory optimization!"
    : sharingEfficiency > 2
      ? "✅ GOOD memory optimization"
      : "⚠️  Still creating new geometries - check implementation"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  public reset(): void {
    this.geometryCreationCount = 0;
    this.materialCloneCount = 0;
    this.sharedGeometryUsageCount = 0;
    this.startTime = Date.now();
  }
}

export const hexGeometryDebugger = HexGeometryDebugger.getInstance();

// Global debug functions
(window as any).logHexGeometryStats = () => hexGeometryDebugger.logSummary();
(window as any).resetHexGeometryStats = () => hexGeometryDebugger.reset();
