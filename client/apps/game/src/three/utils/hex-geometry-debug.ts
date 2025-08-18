/**
 * Debug utility to track hex geometry creation and measure memory impact
 */

class HexGeometryDebugger {
  private static instance: HexGeometryDebugger;
  private geometryCreationCount = 0;
  private materialCloneCount = 0;
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

  public logSummary(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const geometryRate = this.geometryCreationCount / elapsed;
    const materialRate = this.materialCloneCount / elapsed;
    
    console.log(`
📊 HEX GEOMETRY MEMORY WASTE SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Geometries Created: ${this.geometryCreationCount}
🎨 Materials Cloned: ${this.materialCloneCount}
⏱️  Session Time: ${elapsed.toFixed(1)}s
📈 Geometry Rate: ${geometryRate.toFixed(2)}/sec
📈 Material Rate: ${materialRate.toFixed(2)}/sec
💾 Est. Memory Waste: ~${((this.geometryCreationCount * 3) + (this.materialCloneCount * 1.5)).toFixed(1)}KB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  public reset(): void {
    this.geometryCreationCount = 0;
    this.materialCloneCount = 0;
    this.startTime = Date.now();
  }
}

export const hexGeometryDebugger = HexGeometryDebugger.getInstance();

// Global debug functions
(window as any).logHexGeometryStats = () => hexGeometryDebugger.logSummary();
(window as any).resetHexGeometryStats = () => hexGeometryDebugger.reset();