/**
 * BiomeDistributionAnalyzer - Analyzes actual biome usage before allocation
 *
 * Prevents waste by determining exactly which biomes are needed and in what quantities
 * before creating any InstancedMesh objects.
 */

import { BiomeType } from "@bibliothecadao/types";

export interface BiomeDistribution {
  readonly [key: string]: number; // BiomeType | "Outline" -> instance count
}

export interface BiomeAnalysisConfig {
  readonly bufferPercentage: number; // Buffer for dynamic additions (default: 15%)
  readonly minimumBuffer: number; // Minimum buffer instances (default: 10)
  readonly maxOutlineDistance: number; // Max distance for outline hexes (default: 2)
}

export class BiomeDistributionAnalyzer {
  private static readonly DEFAULT_CONFIG: BiomeAnalysisConfig = {
    bufferPercentage: 0.15, // 15% buffer
    minimumBuffer: 10,
    maxOutlineDistance: 2,
  };

  /**
   * Analyze biome distribution for a chunk based on exploration data
   */
  public static analyzeBiomeDistribution(
    exploredTiles: Map<number, Map<number, BiomeType>>,
    structureHexCoords: Map<number, Set<number>>,
    questHexCoords: Map<number, Set<number>>,
    chunkBounds: {
      startRow: number;
      startCol: number;
      width: number;
      height: number;
    },
    config: Partial<BiomeAnalysisConfig> = {},
  ): BiomeDistribution {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const distribution = new Map<string, number>();

    const { startRow, startCol, width, height } = chunkBounds;

    // Analyze each hex in the chunk
    for (let rowOffset = -height / 2; rowOffset <= height / 2; rowOffset++) {
      for (let colOffset = -width / 2; colOffset <= width / 2; colOffset++) {
        const globalRow = startRow + rowOffset;
        const globalCol = startCol + colOffset;

        const biomeType = this.determineHexBiomeType(
          globalCol,
          globalRow,
          exploredTiles,
          structureHexCoords,
          questHexCoords,
        );

        // Count this biome usage
        const currentCount = distribution.get(biomeType) || 0;
        distribution.set(biomeType, currentCount + 1);
      }
    }

    // Convert to final distribution with buffers
    return this.applyBufferStrategy(distribution, finalConfig);
  }

  /**
   * Determine what biome type a hex should use
   */
  private static determineHexBiomeType(
    col: number,
    row: number,
    exploredTiles: Map<number, Map<number, BiomeType>>,
    structureHexCoords: Map<number, Set<number>>,
    questHexCoords: Map<number, Set<number>>,
  ): string {
    // Check if structure or quest hex (these get hidden/scaled to 0)
    const isStructure = structureHexCoords.get(col)?.has(row) || false;
    const isQuest = questHexCoords.get(col)?.has(row) || false;

    if (isStructure || isQuest) {
      // These hexes still need biome instances but scaled to 0
      // Use the underlying biome type if explored, otherwise outline
      const biome = exploredTiles.get(col)?.get(row);
      return biome ? biome.toString() : "Outline";
    }

    // Check if hex is explored
    const biome = exploredTiles.get(col)?.get(row);
    if (biome) {
      return biome.toString();
    }

    // Unexplored hex gets outline
    return "Outline";
  }

  /**
   * Apply buffer strategy to raw counts
   */
  private static applyBufferStrategy(
    rawDistribution: Map<string, number>,
    config: BiomeAnalysisConfig,
  ): BiomeDistribution {
    const result: { [key: string]: number } = {};

    for (const [biomeType, count] of rawDistribution) {
      // Calculate buffer
      const bufferAmount = Math.max(Math.ceil(count * config.bufferPercentage), config.minimumBuffer);

      result[biomeType] = count + bufferAmount;
    }

    return result;
  }

  /**
   * Get memory savings estimate compared to fixed allocation
   */
  public static estimateMemorySavings(
    distribution: BiomeDistribution,
    fixedAllocationSize: number,
    totalBiomeTypes: number,
  ): {
    actualInstances: number;
    fixedInstances: number;
    savedInstances: number;
    savedMemoryMB: number;
  } {
    const actualInstances = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const fixedInstances = fixedAllocationSize * totalBiomeTypes;
    const savedInstances = fixedInstances - actualInstances;

    // Rough estimate: 64 bytes per instance (matrix) + overhead
    const savedMemoryMB = (savedInstances * 80) / (1024 * 1024);

    return {
      actualInstances,
      fixedInstances,
      savedInstances,
      savedMemoryMB,
    };
  }

  /**
   * Debug logging for distribution analysis
   */
  public static logDistribution(distribution: BiomeDistribution, chunkKey: string): void {
    const totalInstances = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const biomeCount = Object.keys(distribution).length;

    console.log(`
🔍 BIOME DISTRIBUTION ANALYSIS - Chunk ${chunkKey}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total Instances: ${totalInstances}
🎨 Biome Types Used: ${biomeCount}/18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Log each biome type and count
    Object.entries(distribution)
      .sort(([, a], [, b]) => b - a) // Sort by count descending
      .forEach(([biome, count]) => {
        const percentage = ((count / totalInstances) * 100).toFixed(1);
        console.log(`  🌍 ${biome.padEnd(20)}: ${count.toString().padStart(4)} (${percentage}%)`);
      });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
}
