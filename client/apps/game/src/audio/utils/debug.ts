import { AudioManager } from "../core/AudioManager";

/**
 * Debug utilities for monitoring audio pool performance
 */
export class AudioDebugger {
  /**
   * Log current pool statistics to console
   */
  static logPoolStats(): void {
    const manager = AudioManager.getInstance();
    const poolStats = manager.getPoolStats();
    const aggregatedStats = manager.getMetrics();

    console.group("🎵 Audio Pool Statistics");
    console.log("📊 Aggregated Stats:", aggregatedStats);
    console.log("🏊 Pool Details:");

    Object.entries(poolStats).forEach(([assetId, stats]) => {
      const efficiency = stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : "0.0";
      console.log(`  ${assetId}: ${stats.active}/${stats.total} (${efficiency}% efficiency)`);
    });

    console.groupEnd();
  }

  /**
   * Start monitoring pool stats at regular intervals
   */
  static startMonitoring(intervalMs: number = 10000): () => void {
    const interval = setInterval(() => {
      this.logPoolStats();
    }, intervalMs);

    console.log(`🎵 Audio pool monitoring started (${intervalMs}ms intervals)`);

    // Return cleanup function
    return () => {
      clearInterval(interval);
      console.log("🎵 Audio pool monitoring stopped");
    };
  }

  /**
   * Get pool stats as JSON for external monitoring
   */
  static getPoolStatsJSON(): string {
    const manager = AudioManager.getInstance();
    const poolStats = manager.getPoolStats();
    const aggregatedStats = manager.getMetrics();

    return JSON.stringify(
      {
        timestamp: Date.now(),
        aggregated: aggregatedStats,
        pools: poolStats,
      },
      null,
      2,
    );
  }

  /**
   * Trigger pool optimization manually
   */
  static optimizePools(): void {
    const manager = AudioManager.getInstance();
    manager.optimizePools();
    console.log("🎵 Audio pools optimized");
    this.logPoolStats();
  }
}
