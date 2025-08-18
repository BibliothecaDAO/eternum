/**
 * MemoryMonitor - Real-time memory usage tracking for ThreeJS applications
 * 
 * Monitors:
 * - Browser heap memory
 * - ThreeJS resource counts
 * - Memory spikes and patterns
 * - Manager-specific memory usage
 */

import * as THREE from "three";

export interface MemoryStats {
  // Browser Memory
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  
  // ThreeJS Resources
  geometries: number;
  materials: number;
  textures: number;
  
  // Memory Metrics (MB)
  heapUsedMB: number;
  heapTotalMB: number;
  heapLimitMB: number;
  
  // Spike Detection
  memorySpike: boolean;
  spikeIncrease: number;
  
  // Timestamp
  timestamp: number;
}

export interface MemorySpike {
  timestamp: number;
  previousMB: number;
  currentMB: number;
  increaseMB: number;
  context: string;
}

export class MemoryMonitor {
  private previousHeapSize: number = 0;
  private spikeThresholdMB: number = 50; // Alert when memory increases by 50MB+
  private samples: MemoryStats[] = [];
  private maxSamples: number = 300; // Keep 5 minutes of data (at 1 sample/second)
  private spikes: MemorySpike[] = [];
  private maxSpikes: number = 50;
  private isEnabled: boolean = true;
  
  // Callbacks for spike detection
  private onMemorySpike?: (spike: MemorySpike) => void;
  
  constructor(options?: {
    spikeThresholdMB?: number;
    maxSamples?: number;
    onMemorySpike?: (spike: MemorySpike) => void;
  }) {
    if (options) {
      this.spikeThresholdMB = options.spikeThresholdMB ?? 50;
      this.maxSamples = options.maxSamples ?? 300;
      this.onMemorySpike = options.onMemorySpike;
    }
    
    this.previousHeapSize = this.getHeapUsedMB();
  }
  
  /**
   * Get current memory statistics
   */
  public getCurrentStats(context: string = "default"): MemoryStats {
    const memory = (performance as any).memory;
    const heapUsedMB = this.getHeapUsedMB();
    const heapTotalMB = this.bytesToMB(memory?.totalJSHeapSize || 0);
    const heapLimitMB = this.bytesToMB(memory?.jsHeapSizeLimit || 0);
    
    // Detect memory spikes
    const spikeIncrease = heapUsedMB - this.previousHeapSize;
    const memorySpike = spikeIncrease > this.spikeThresholdMB;
    
    if (memorySpike) {
      const spike: MemorySpike = {
        timestamp: Date.now(),
        previousMB: this.previousHeapSize,
        currentMB: heapUsedMB,
        increaseMB: spikeIncrease,
        context,
      };
      
      this.recordSpike(spike);
    }
    
    const stats: MemoryStats = {
      usedJSHeapSize: memory?.usedJSHeapSize || 0,
      totalJSHeapSize: memory?.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0,
      geometries: this.getThreeJSResourceCount('geometries'),
      materials: this.getThreeJSResourceCount('materials'),
      textures: this.getThreeJSResourceCount('textures'),
      heapUsedMB,
      heapTotalMB,
      heapLimitMB,
      memorySpike,
      spikeIncrease,
      timestamp: Date.now(),
    };
    
    this.recordSample(stats);
    this.previousHeapSize = heapUsedMB;
    
    return stats;
  }
  
  /**
   * Get memory usage in MB
   */
  private getHeapUsedMB(): number {
    const memory = (performance as any).memory;
    return this.bytesToMB(memory?.usedJSHeapSize || 0);
  }
  
  /**
   * Convert bytes to MB
   */
  private bytesToMB(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }
  
  /**
   * Get ThreeJS resource counts from renderer info
   */
  private getThreeJSResourceCount(type: 'geometries' | 'materials' | 'textures'): number {
    try {
      // Try to get from renderer info if available
      const rendererInfo = (window as any).__gameRenderer?.renderer?.info;
      
      if (rendererInfo) {
        switch (type) {
          case 'geometries':
            return rendererInfo.memory?.geometries || 0;
          case 'materials':  
            return rendererInfo.programs?.length || 0; // Programs are tied to materials
          case 'textures':
            return rendererInfo.memory?.textures || 0;
        }
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Update renderer reference for better resource tracking
   */
  public setRenderer(renderer: THREE.WebGLRenderer): void {
    (window as any).__memoryMonitorRenderer = renderer;
  }
  
  /**
   * Record a memory sample
   */
  private recordSample(stats: MemoryStats): void {
    if (!this.isEnabled) return;
    
    this.samples.push(stats);
    
    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }
  
  /**
   * Record a memory spike
   */
  private recordSpike(spike: MemorySpike): void {
    this.spikes.push(spike);
    
    // Keep only recent spikes
    if (this.spikes.length > this.maxSpikes) {
      this.spikes.shift();
    }
    
    // Log the spike
    console.warn(`🚨 Memory spike detected: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`, spike);
    
    // Call callback if provided
    if (this.onMemorySpike) {
      this.onMemorySpike(spike);
    }
  }
  
  /**
   * Get recent memory samples
   */
  public getRecentSamples(count: number = 60): MemoryStats[] {
    return this.samples.slice(-count);
  }
  
  /**
   * Get memory spikes
   */
  public getSpikes(): MemorySpike[] {
    return [...this.spikes];
  }
  
  /**
   * Get memory usage trend (increase/decrease per second)
   */
  public getMemoryTrend(): number {
    if (this.samples.length < 2) return 0;
    
    const recent = this.samples.slice(-10); // Last 10 samples
    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeSpanSeconds = (last.timestamp - first.timestamp) / 1000;
    
    if (timeSpanSeconds === 0) return 0;
    
    return (last.heapUsedMB - first.heapUsedMB) / timeSpanSeconds;
  }
  
  /**
   * Get average memory usage over recent samples
   */
  public getAverageMemoryUsage(samples: number = 60): number {
    const recent = this.getRecentSamples(samples);
    if (recent.length === 0) return 0;
    
    const total = recent.reduce((sum, sample) => sum + sample.heapUsedMB, 0);
    return total / recent.length;
  }
  
  /**
   * Check if browser supports memory API
   */
  public static isMemoryAPISupported(): boolean {
    return !!(performance as any).memory;
  }
  
  /**
   * Enable/disable monitoring
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
  
  /**
   * Clear all recorded data
   */
  public clear(): void {
    this.samples = [];
    this.spikes = [];
    this.previousHeapSize = this.getHeapUsedMB();
  }
  
  /**
   * Get summary statistics
   */
  public getSummary(): {
    currentMB: number;
    averageMB: number;
    trendMBPerSecond: number;
    spikeCount: number;
    largestSpikeMB: number;
  } {
    const current = this.getCurrentStats();
    const average = this.getAverageMemoryUsage();
    const trend = this.getMemoryTrend();
    const spikeCount = this.spikes.length;
    const largestSpike = this.spikes.reduce((max, spike) => 
      Math.max(max, spike.increaseMB), 0
    );
    
    return {
      currentMB: current.heapUsedMB,
      averageMB: Math.round(average * 100) / 100,
      trendMBPerSecond: Math.round(trend * 100) / 100,
      spikeCount,
      largestSpikeMB: Math.round(largestSpike * 100) / 100,
    };
  }
}