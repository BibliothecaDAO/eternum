import { withSpan, addEvent, setSpanAttributes } from "../tracer";
import { addBreadcrumb } from "../errors/error-reporter";

interface PerformanceMetrics {
  fps: number;
  memory: {
    used: number;
    limit: number;
    percent: number;
  };
  network: {
    latency: number;
    bandwidth: number;
    packetLoss: number;
  };
  cpu: {
    usage: number;
    throttling: boolean;
  };
  rendering: {
    paintTime: number;
    layoutTime: number;
    scriptTime: number;
  };
}

interface GameMetrics {
  armyMovementCalculationTime: number;
  resourceProductionCycleTime: number;
  marketTransactionTime: number;
  battleSimulationTime: number;
  mapTileLoadTime: number;
  stateUpdateTime: number;
  entityCount: number;
  activeArmiesCount: number;
  activeTradesCount: number;
}

interface MetricThresholds {
  fps: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  latency: { warning: number; critical: number };
  cpuUsage: { warning: number; critical: number };
  [key: string]: { warning: number; critical: number };
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private performanceMetrics: PerformanceMetrics[] = [];
  private gameMetrics: GameMetrics[] = [];
  private metricsHistorySize = 300; // 5 minutes at 1 sample/second
  private collectionInterval?: NodeJS.Timeout;
  private thresholds: MetricThresholds = {
    fps: { warning: 45, critical: 30 },
    memory: { warning: 70, critical: 85 },
    latency: { warning: 100, critical: 200 },
    cpuUsage: { warning: 70, critical: 90 },
  };
  private alertCallbacks: Map<string, (metric: string, value: number, threshold: number) => void> = new Map();

  private constructor() {
    this.setupPerformanceObserver();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private setupPerformanceObserver(): void {
    if ("PerformanceObserver" in window) {
      // Observe long tasks
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              addEvent("long_task", {
                duration: entry.duration,
                name: entry.name,
                startTime: entry.startTime,
              });

              if (entry.duration > 100) {
                addBreadcrumb({
                  type: "custom",
                  category: "performance",
                  message: `Long task detected: ${entry.duration.toFixed(2)}ms`,
                  data: {
                    taskName: entry.name,
                    duration: entry.duration,
                  },
                });
              }
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch (e) {
        console.warn("Long task observer not supported");
      }

      // Observe layout shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          if (clsValue > 0.1) {
            addEvent("layout_shift", {
              cls_value: clsValue,
            });
          }
        });
        layoutShiftObserver.observe({ entryTypes: ["layout-shift"] });
      } catch (e) {
        console.warn("Layout shift observer not supported");
      }
    }
  }

  public startCollection(intervalMs: number = 1000): void {
    if (this.collectionInterval) {
      this.stopCollection();
    }

    this.collectionInterval = setInterval(() => {
      this.collectPerformanceMetrics();
      this.checkThresholds();
    }, intervalMs);
  }

  public stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
  }

  private collectPerformanceMetrics(): void {
    const metrics: PerformanceMetrics = {
      fps: this.calculateFPS(),
      memory: this.getMemoryUsage(),
      network: this.getNetworkMetrics(),
      cpu: this.getCPUMetrics(),
      rendering: this.getRenderingMetrics(),
    };

    this.performanceMetrics.push(metrics);
    if (this.performanceMetrics.length > this.metricsHistorySize) {
      this.performanceMetrics.shift();
    }

    // Update span attributes with latest metrics
    setSpanAttributes({
      "metrics.fps": metrics.fps,
      "metrics.memory.percent": metrics.memory.percent,
      "metrics.network.latency": metrics.network.latency,
      "metrics.cpu.usage": metrics.cpu.usage,
    });
  }

  private calculateFPS(): number {
    // Use requestAnimationFrame to calculate FPS
    let fps = 60;
    let lastTime = performance.now();

    requestAnimationFrame(() => {
      const currentTime = performance.now();
      const delta = currentTime - lastTime;
      fps = Math.round(1000 / delta);
    });

    return fps;
  }

  private getMemoryUsage(): PerformanceMetrics["memory"] {
    const memory = (performance as any).memory;
    if (memory) {
      const used = memory.usedJSHeapSize;
      const limit = memory.jsHeapSizeLimit;
      return {
        used: used / 1048576, // Convert to MB
        limit: limit / 1048576,
        percent: (used / limit) * 100,
      };
    }
    return { used: 0, limit: 0, percent: 0 };
  }

  private getNetworkMetrics(): PerformanceMetrics["network"] {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const connection = (navigator as any).connection;

    return {
      latency: navigation ? navigation.responseStart - navigation.fetchStart : 0,
      bandwidth: connection?.downlink || 0,
      packetLoss: 0, // Would need WebRTC stats for real packet loss
    };
  }

  private getCPUMetrics(): PerformanceMetrics["cpu"] {
    // Estimate CPU usage based on main thread blocking
    const longTasks = performance.getEntriesByType("measure").filter((entry) => entry.duration > 50);

    const totalBlockingTime = longTasks.reduce((sum, task) => sum + task.duration, 0);
    const timeWindow = 1000; // 1 second window
    const usage = Math.min((totalBlockingTime / timeWindow) * 100, 100);

    return {
      usage,
      throttling: usage > 80,
    };
  }

  private getRenderingMetrics(): PerformanceMetrics["rendering"] {
    const paintEntries = performance.getEntriesByType("paint");
    const lastPaint = paintEntries[paintEntries.length - 1];

    return {
      paintTime: lastPaint?.startTime || 0,
      layoutTime: 0, // Would need more detailed measurements
      scriptTime: 0, // Would need more detailed measurements
    };
  }

  public recordGameMetric(metric: Partial<GameMetrics>): void {
    const currentMetrics = this.gameMetrics[this.gameMetrics.length - 1] || ({} as GameMetrics);
    const newMetrics = { ...currentMetrics, ...metric };

    this.gameMetrics.push(newMetrics);
    if (this.gameMetrics.length > this.metricsHistorySize) {
      this.gameMetrics.shift();
    }

    // Log slow operations
    Object.entries(metric).forEach(([key, value]) => {
      if (typeof value === "number" && value > 1000) {
        addBreadcrumb({
          type: "custom",
          category: "game",
          message: `Slow operation: ${key} took ${value}ms`,
          data: { metric: key, value },
        });
      }
    });
  }

  public measureOperation<T>(operationName: string, operation: () => T | Promise<T>): T | Promise<T> {
    const startTime = performance.now();

    const recordMetric = () => {
      const duration = performance.now() - startTime;
      this.recordGameMetric({ [operationName]: duration } as any);

      addEvent(`game.operation.${operationName}`, {
        duration_ms: duration,
      });

      return duration;
    };

    const result = operation();

    if (result instanceof Promise) {
      return result.finally(recordMetric) as T | Promise<T>;
    } else {
      recordMetric();
      return result;
    }
  }

  private checkThresholds(): void {
    const latestMetrics = this.performanceMetrics[this.performanceMetrics.length - 1];
    if (!latestMetrics) return;

    // Check FPS
    if (latestMetrics.fps < this.thresholds.fps.critical) {
      this.triggerAlert("fps", latestMetrics.fps, this.thresholds.fps.critical);
    } else if (latestMetrics.fps < this.thresholds.fps.warning) {
      this.triggerAlert("fps", latestMetrics.fps, this.thresholds.fps.warning);
    }

    // Check Memory
    if (latestMetrics.memory.percent > this.thresholds.memory.critical) {
      this.triggerAlert("memory", latestMetrics.memory.percent, this.thresholds.memory.critical);
    } else if (latestMetrics.memory.percent > this.thresholds.memory.warning) {
      this.triggerAlert("memory", latestMetrics.memory.percent, this.thresholds.memory.warning);
    }

    // Check Latency
    if (latestMetrics.network.latency > this.thresholds.latency.critical) {
      this.triggerAlert("latency", latestMetrics.network.latency, this.thresholds.latency.critical);
    } else if (latestMetrics.network.latency > this.thresholds.latency.warning) {
      this.triggerAlert("latency", latestMetrics.network.latency, this.thresholds.latency.warning);
    }

    // Check CPU
    if (latestMetrics.cpu.usage > this.thresholds.cpuUsage.critical) {
      this.triggerAlert("cpu", latestMetrics.cpu.usage, this.thresholds.cpuUsage.critical);
    } else if (latestMetrics.cpu.usage > this.thresholds.cpuUsage.warning) {
      this.triggerAlert("cpu", latestMetrics.cpu.usage, this.thresholds.cpuUsage.warning);
    }
  }

  private triggerAlert(metric: string, value: number, threshold: number): void {
    this.alertCallbacks.forEach((callback) => {
      callback(metric, value, threshold);
    });

    addEvent("performance.alert", {
      metric,
      value,
      threshold,
      severity: threshold === this.thresholds[metric]?.critical ? "critical" : "warning",
    });
  }

  public setThreshold(metric: string, warning: number, critical: number): void {
    this.thresholds[metric] = { warning, critical };
  }

  public onAlert(name: string, callback: (metric: string, value: number, threshold: number) => void): void {
    this.alertCallbacks.set(name, callback);
  }

  public removeAlert(name: string): void {
    this.alertCallbacks.delete(name);
  }

  public getLatestMetrics(): PerformanceMetrics | undefined {
    return this.performanceMetrics[this.performanceMetrics.length - 1];
  }

  public getAverageMetrics(windowSize: number = 60): PerformanceMetrics | null {
    const window = this.performanceMetrics.slice(-windowSize);
    if (window.length === 0) return null;

    const sum = window.reduce((acc, m) => ({
      fps: acc.fps + m.fps,
      memory: {
        used: acc.memory.used + m.memory.used,
        limit: m.memory.limit, // Use latest limit
        percent: acc.memory.percent + m.memory.percent,
      },
      network: {
        latency: acc.network.latency + m.network.latency,
        bandwidth: acc.network.bandwidth + m.network.bandwidth,
        packetLoss: acc.network.packetLoss + m.network.packetLoss,
      },
      cpu: {
        usage: acc.cpu.usage + m.cpu.usage,
        throttling: acc.cpu.throttling || m.cpu.throttling,
      },
      rendering: {
        paintTime: acc.rendering.paintTime + m.rendering.paintTime,
        layoutTime: acc.rendering.layoutTime + m.rendering.layoutTime,
        scriptTime: acc.rendering.scriptTime + m.rendering.scriptTime,
      },
    }));

    const count = window.length;
    return {
      fps: sum.fps / count,
      memory: {
        used: sum.memory.used / count,
        limit: sum.memory.limit,
        percent: sum.memory.percent / count,
      },
      network: {
        latency: sum.network.latency / count,
        bandwidth: sum.network.bandwidth / count,
        packetLoss: sum.network.packetLoss / count,
      },
      cpu: {
        usage: sum.cpu.usage / count,
        throttling: sum.cpu.throttling,
      },
      rendering: {
        paintTime: sum.rendering.paintTime / count,
        layoutTime: sum.rendering.layoutTime / count,
        scriptTime: sum.rendering.scriptTime / count,
      },
    };
  }

  public getMetricsHistory(): {
    performance: PerformanceMetrics[];
    game: GameMetrics[];
  } {
    return {
      performance: [...this.performanceMetrics],
      game: [...this.gameMetrics],
    };
  }

  public reset(): void {
    this.performanceMetrics = [];
    this.gameMetrics = [];
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();

// Export convenience functions
export const startMetricsCollection = metricsCollector.startCollection.bind(metricsCollector);
export const stopMetricsCollection = metricsCollector.stopCollection.bind(metricsCollector);
export const recordGameMetric = metricsCollector.recordGameMetric.bind(metricsCollector);
export const measureOperation = metricsCollector.measureOperation.bind(metricsCollector);
export const getLatestMetrics = metricsCollector.getLatestMetrics.bind(metricsCollector);
export const onMetricAlert = metricsCollector.onAlert.bind(metricsCollector);
