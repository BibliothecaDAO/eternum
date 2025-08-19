import { AudioAsset } from '../types';
import { AudioPool } from './AudioPool';

/**
 * Manages multiple AudioPool instances for different audio assets
 */
export class AudioPoolManager {
  private readonly audioContext: AudioContext;
  private readonly pools = new Map<string, AudioPool>();
  private readonly audioBuffers = new Map<string, AudioBuffer>();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Register an audio buffer and create its pool
   */
  registerAsset(asset: AudioAsset, audioBuffer: AudioBuffer): void {
    // Skip if already registered
    if (this.pools.has(asset.id)) {
      return;
    }
    
    this.audioBuffers.set(asset.id, audioBuffer);
    
    // Create pool for this asset
    const pool = new AudioPool(this.audioContext, audioBuffer, asset);
    this.pools.set(asset.id, pool);
  }

  /**
   * Get an audio node from the appropriate pool
   */
  getNode(assetId: string): AudioBufferSourceNode | null {
    const pool = this.pools.get(assetId);
    if (!pool) {
      console.warn(`AudioPoolManager: No pool found for asset ${assetId}`);
      return null;
    }
    
    return pool.getNode();
  }

  /**
   * Stop all nodes for a specific asset
   */
  stopAsset(assetId: string): void {
    const pool = this.pools.get(assetId);
    if (pool) {
      pool.stopAll();
    }
  }

  /**
   * Stop all nodes across all pools
   */
  stopAll(): void {
    this.pools.forEach(pool => pool.stopAll());
  }

  /**
   * Get statistics for all pools
   */
  getAllStats(): Record<string, {
    available: number;
    active: number;
    total: number;
    maxPoolSize: number;
    assetId: string;
  }> {
    const stats: Record<string, any> = {};
    this.pools.forEach((pool, assetId) => {
      stats[assetId] = pool.getStats();
    });
    return stats;
  }

  /**
   * Get aggregated statistics
   */
  getAggregatedStats(): {
    totalPools: number;
    totalAvailableNodes: number;
    totalActiveNodes: number;
    totalNodes: number;
    memoryEfficiency: number; // ratio of active to total nodes
  } {
    let totalAvailable = 0;
    let totalActive = 0;
    let totalNodes = 0;
    
    this.pools.forEach(pool => {
      const stats = pool.getStats();
      totalAvailable += stats.available;
      totalActive += stats.active;
      totalNodes += stats.total;
    });
    
    return {
      totalPools: this.pools.size,
      totalAvailableNodes: totalAvailable,
      totalActiveNodes: totalActive,
      totalNodes,
      memoryEfficiency: totalNodes > 0 ? totalActive / totalNodes : 0,
    };
  }

  /**
   * Optimize pools based on usage patterns
   */
  optimizePools(): void {
    this.pools.forEach((pool, assetId) => {
      const stats = pool.getStats();
      
      // If pool is frequently fully utilized, consider increasing size
      if (stats.active === stats.maxPoolSize && stats.available === 0) {
        const newSize = Math.min(stats.maxPoolSize * 1.5, 16); // Cap at 16 nodes
        pool.resizePool(newSize);
      }
      
      // If pool has been mostly unused, consider shrinking it
      else if (stats.active === 0 && stats.available > 2) {
        const newSize = Math.max(2, Math.floor(stats.maxPoolSize * 0.8));
        pool.resizePool(newSize);
      }
    });
  }

  /**
   * Remove a pool and clean up its resources
   */
  removePool(assetId: string): void {
    const pool = this.pools.get(assetId);
    if (pool) {
      pool.stopAll();
      this.pools.delete(assetId);
      this.audioBuffers.delete(assetId);
    }
  }

  /**
   * Clear all pools and clean up resources
   */
  dispose(): void {
    this.stopAll();
    this.pools.clear();
    this.audioBuffers.clear();
  }
}