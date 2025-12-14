/**
 * PerformanceMonitor - Centralized performance tracking for Three.js scene
 *
 * Provides:
 * - Automatic performance.mark()/measure() instrumentation
 * - Rolling averages for frame times
 * - Memory tracking via MatrixPool
 * - GUI integration for real-time monitoring
 * - Hex exploration simulation for testing
 */

interface PerformanceMetric {
  name: string;
  samples: number[];
  maxSamples: number;
  lastValue: number;
  average: number;
  min: number;
  max: number;
}

interface PerformanceReport {
  metrics: Record<string, { avg: number; min: number; max: number; last: number }>;
  memory: {
    matrixPool: { available: number; inUse: number; totalAllocated: number; memoryMB: number };
    jsHeap?: { usedMB: number; totalMB: number };
  };
  frameTime: { avg: number; min: number; max: number };
  discoveredHexCount: number;
}

type MetricCallback = (name: string, duration: number) => void;

class PerformanceMonitorImpl {
  private static instance: PerformanceMonitorImpl;

  private metrics: Map<string, PerformanceMetric> = new Map();
  private activeMarks: Map<string, number> = new Map();
  private enabled: boolean = true;
  private maxSamples: number = 60; // ~1 second at 60fps
  private callbacks: Set<MetricCallback> = new Set();

  // Frame tracking
  private lastFrameTime: number = 0;
  private frameMetric: PerformanceMetric;

  // Hex simulation state
  private simulatedHexCount: number = 0;
  private isSimulating: boolean = false;

  private constructor() {
    this.frameMetric = this.createMetric("frame");
  }

  public static getInstance(): PerformanceMonitorImpl {
    if (!PerformanceMonitorImpl.instance) {
      PerformanceMonitorImpl.instance = new PerformanceMonitorImpl();
    }
    return PerformanceMonitorImpl.instance;
  }

  // ===========================================================================
  // Core Instrumentation
  // ===========================================================================

  /**
   * Start timing a named operation
   */
  public begin(name: string): void {
    if (!this.enabled) return;

    const markName = `perf_${name}_start`;
    this.activeMarks.set(name, performance.now());

    try {
      performance.mark(markName);
    } catch {
      // Ignore if marks not supported
    }
  }

  /**
   * End timing a named operation and record the duration
   */
  public end(name: string): number {
    if (!this.enabled) return 0;

    const startTime = this.activeMarks.get(name);
    if (startTime === undefined) return 0;

    const duration = performance.now() - startTime;
    this.activeMarks.delete(name);

    // Record to metrics
    this.recordMetric(name, duration);

    // Performance API measure
    try {
      const startMark = `perf_${name}_start`;
      const endMark = `perf_${name}_end`;
      performance.mark(endMark);
      performance.measure(`perf_${name}`, startMark, endMark);
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
    } catch {
      // Ignore if measures not supported
    }

    // Notify callbacks
    this.callbacks.forEach((cb) => cb(name, duration));

    return duration;
  }

  /**
   * Wrap a function with automatic timing
   */
  public wrap<T extends (...args: any[]) => any>(name: string, fn: T): T {
    const monitor = this;
    return function (this: any, ...args: Parameters<T>): ReturnType<T> {
      monitor.begin(name);
      try {
        const result = fn.apply(this, args);
        // Handle promises
        if (result instanceof Promise) {
          return result.finally(() => monitor.end(name)) as ReturnType<T>;
        }
        monitor.end(name);
        return result;
      } catch (e) {
        monitor.end(name);
        throw e;
      }
    } as T;
  }

  /**
   * Record a frame boundary (call at start of each render)
   */
  public recordFrame(): void {
    if (!this.enabled) return;

    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      this.updateMetric(this.frameMetric, frameTime);
    }
    this.lastFrameTime = now;
  }

  // ===========================================================================
  // Metric Management
  // ===========================================================================

  private createMetric(name: string): PerformanceMetric {
    return {
      name,
      samples: [],
      maxSamples: this.maxSamples,
      lastValue: 0,
      average: 0,
      min: Infinity,
      max: 0,
    };
  }

  private recordMetric(name: string, value: number): void {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = this.createMetric(name);
      this.metrics.set(name, metric);
    }
    this.updateMetric(metric, value);
  }

  private updateMetric(metric: PerformanceMetric, value: number): void {
    metric.samples.push(value);
    if (metric.samples.length > metric.maxSamples) {
      metric.samples.shift();
    }

    metric.lastValue = value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.average = metric.samples.reduce((a, b) => a + b, 0) / metric.samples.length;
  }

  public getMetric(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  public getAllMetrics(): Map<string, PerformanceMetric> {
    return this.metrics;
  }

  // ===========================================================================
  // Hex Simulation
  // ===========================================================================

  /**
   * Get simulated hex count for testing
   */
  public getSimulatedHexCount(): number {
    return this.simulatedHexCount;
  }

  /**
   * Set simulated hex count (for GUI control)
   */
  public setSimulatedHexCount(count: number): void {
    this.simulatedHexCount = Math.max(0, count);
  }

  /**
   * Check if simulation is active
   */
  public isSimulationActive(): boolean {
    return this.isSimulating;
  }

  /**
   * Start/stop simulation
   */
  public setSimulating(active: boolean): void {
    this.isSimulating = active;
  }

  // ===========================================================================
  // Reporting
  // ===========================================================================

  /**
   * Generate a performance report
   */
  public generateReport(matrixPoolStats?: {
    available: number;
    inUse: number;
    totalAllocated: number;
    memoryEstimateMB: number;
  }): PerformanceReport {
    const metricsReport: PerformanceReport["metrics"] = {};

    this.metrics.forEach((metric, name) => {
      metricsReport[name] = {
        avg: Math.round(metric.average * 100) / 100,
        min: Math.round(metric.min * 100) / 100,
        max: Math.round(metric.max * 100) / 100,
        last: Math.round(metric.lastValue * 100) / 100,
      };
    });

    // Memory info
    const memory: PerformanceReport["memory"] = {
      matrixPool: matrixPoolStats
        ? {
            available: matrixPoolStats.available,
            inUse: matrixPoolStats.inUse,
            totalAllocated: matrixPoolStats.totalAllocated,
            memoryMB: Math.round(matrixPoolStats.memoryEstimateMB * 100) / 100,
          }
        : { available: 0, inUse: 0, totalAllocated: 0, memoryMB: 0 },
    };

    // JS heap if available
    if (performance && (performance as any).memory) {
      const mem = (performance as any).memory;
      memory.jsHeap = {
        usedMB: Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 100) / 100,
        totalMB: Math.round((mem.totalJSHeapSize / (1024 * 1024)) * 100) / 100,
      };
    }

    return {
      metrics: metricsReport,
      memory,
      frameTime: {
        avg: Math.round(this.frameMetric.average * 100) / 100,
        min: Math.round(this.frameMetric.min * 100) / 100,
        max: Math.round(this.frameMetric.max * 100) / 100,
      },
      discoveredHexCount: this.simulatedHexCount,
    };
  }

  /**
   * Log a performance summary to console
   */
  public logSummary(matrixPoolStats?: Parameters<typeof this.generateReport>[0]): void {
    const report = this.generateReport(matrixPoolStats);

    console.group("Performance Summary");
    console.log(
      `Frame Time: avg=${report.frameTime.avg}ms, min=${report.frameTime.min}ms, max=${report.frameTime.max}ms`,
    );
    console.log(`FPS: ~${Math.round(1000 / report.frameTime.avg)}`);

    if (report.memory.jsHeap) {
      console.log(`JS Heap: ${report.memory.jsHeap.usedMB}MB / ${report.memory.jsHeap.totalMB}MB`);
    }

    console.log(
      `Matrix Pool: ${report.memory.matrixPool.inUse} in use, ${report.memory.matrixPool.totalAllocated} allocated (${report.memory.matrixPool.memoryMB}MB)`,
    );

    console.group("Metrics");
    Object.entries(report.metrics).forEach(([name, data]) => {
      console.log(`${name}: avg=${data.avg}ms, last=${data.last}ms`);
    });
    console.groupEnd();

    console.groupEnd();
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public addCallback(callback: MetricCallback): void {
    this.callbacks.add(callback);
  }

  public removeCallback(callback: MetricCallback): void {
    this.callbacks.delete(callback);
  }

  public reset(): void {
    this.metrics.clear();
    this.activeMarks.clear();
    this.frameMetric = this.createMetric("frame");
    this.lastFrameTime = 0;
  }
}

// Export singleton
export const PerformanceMonitor = PerformanceMonitorImpl.getInstance();

// Export helper for wrapping methods
export function instrumentMethod<T extends (...args: any[]) => any>(name: string, fn: T): T {
  return PerformanceMonitor.wrap(name, fn);
}

// Export decorator for class methods
export function instrument(name?: string) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || propertyKey;

    descriptor.value = function (...args: any[]) {
      PerformanceMonitor.begin(metricName);
      try {
        const result = originalMethod.apply(this, args);
        if (result instanceof Promise) {
          return result.finally(() => PerformanceMonitor.end(metricName));
        }
        PerformanceMonitor.end(metricName);
        return result;
      } catch (e) {
        PerformanceMonitor.end(metricName);
        throw e;
      }
    };

    return descriptor;
  };
}
