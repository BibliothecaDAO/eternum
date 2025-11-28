import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";

/**
 * Quality feature flags that can be individually toggled
 */
export interface QualityFeatures {
  // Rendering
  shadows: boolean;
  shadowMapSize: number;
  pixelRatio: number;

  // Post-processing
  bloom: boolean;
  bloomIntensity: number;
  vignette: boolean;
  fxaa: boolean;

  // Animations
  morphAnimations: boolean;
  animationFPS: number;

  // Entity limits
  maxVisibleArmies: number;
  maxVisibleStructures: number;
  maxVisibleLabels: number;

  // LOD and culling
  labelRenderDistance: number;
  animationCullDistance: number;

  // Chunk system
  chunkLoadRadius: number;
}

/**
 * Complete quality preset with all configurable options
 */
export interface QualityPreset extends QualityFeatures {
  name: string;
  targetFPS: number;
}

/**
 * Quality presets for LOW, MID, HIGH settings
 */
const QUALITY_PRESETS: Record<GraphicsSettings, QualityPreset> = {
  [GraphicsSettings.LOW]: {
    name: "Low",
    targetFPS: 30,
    // Rendering
    shadows: false,
    shadowMapSize: 0,
    pixelRatio: 1,
    // Post-processing
    bloom: false,
    bloomIntensity: 0,
    vignette: false,
    fxaa: false,
    // Animations
    morphAnimations: false,
    animationFPS: 10,
    // Entity limits
    maxVisibleArmies: 100,
    maxVisibleStructures: 50,
    maxVisibleLabels: 75,
    // LOD and culling
    labelRenderDistance: 50,
    animationCullDistance: 60,
    // Chunk system
    chunkLoadRadius: 1,
  },
  [GraphicsSettings.MID]: {
    name: "Medium",
    targetFPS: 45,
    // Rendering
    shadows: true,
    shadowMapSize: 1024,
    pixelRatio: 1.5,
    // Post-processing
    bloom: true,
    bloomIntensity: 0.15,
    vignette: false,
    fxaa: true,
    // Animations
    morphAnimations: true,
    animationFPS: 20,
    // Entity limits
    maxVisibleArmies: 300,
    maxVisibleStructures: 150,
    maxVisibleLabels: 200,
    // LOD and culling
    labelRenderDistance: 100,
    animationCullDistance: 100,
    // Chunk system
    chunkLoadRadius: 2,
  },
  [GraphicsSettings.HIGH]: {
    name: "High",
    targetFPS: 60,
    // Rendering
    shadows: true,
    shadowMapSize: 2048,
    pixelRatio: 2,
    // Post-processing
    bloom: true,
    bloomIntensity: 0.25,
    vignette: true,
    fxaa: true,
    // Animations
    morphAnimations: true,
    animationFPS: 30,
    // Entity limits
    maxVisibleArmies: 1000,
    maxVisibleStructures: 500,
    maxVisibleLabels: 500,
    // LOD and culling
    labelRenderDistance: 200,
    animationCullDistance: 140,
    // Chunk system
    chunkLoadRadius: 3,
  },
};

/**
 * Degradation steps - features to disable in order when FPS drops
 * Each step specifies which feature to toggle and the new value
 */
interface DegradationStep {
  feature: keyof QualityFeatures;
  value: QualityFeatures[keyof QualityFeatures];
  description: string;
}

const DEGRADATION_STEPS: DegradationStep[] = [
  { feature: "vignette", value: false, description: "Disabled vignette effect" },
  { feature: "bloomIntensity", value: 0.1, description: "Reduced bloom intensity" },
  { feature: "animationFPS", value: 15, description: "Reduced animation FPS to 15" },
  { feature: "maxVisibleLabels", value: 150, description: "Reduced max visible labels" },
  { feature: "bloom", value: false, description: "Disabled bloom effect" },
  { feature: "morphAnimations", value: false, description: "Disabled morph animations" },
  { feature: "fxaa", value: false, description: "Disabled FXAA anti-aliasing" },
  { feature: "shadowMapSize", value: 1024, description: "Reduced shadow map size" },
  { feature: "maxVisibleArmies", value: 200, description: "Reduced max visible armies" },
  { feature: "maxVisibleStructures", value: 100, description: "Reduced max visible structures" },
  { feature: "shadows", value: false, description: "Disabled shadows" },
  { feature: "pixelRatio", value: 1, description: "Reduced pixel ratio to 1" },
];

/**
 * Event types emitted by QualityController
 */
export type QualityChangeEvent = {
  type: "quality-change";
  previousFeatures: QualityFeatures;
  currentFeatures: QualityFeatures;
  reason: "auto-downgrade" | "auto-upgrade" | "manual" | "reset";
  changedFeature?: keyof QualityFeatures;
  description?: string;
};

export type QualityEventListener = (event: QualityChangeEvent) => void;

/**
 * Configuration for the QualityController
 */
export interface QualityControllerConfig {
  /** Enable automatic quality adjustment based on FPS */
  autoAdjustEnabled?: boolean;
  /** Number of frames to average for FPS calculation */
  fpsHistorySize?: number;
  /** Threshold below target FPS to trigger downgrade (0-1, e.g., 0.7 = 70% of target) */
  downgradeThreshold?: number;
  /** Threshold above target FPS to consider upgrade (0-1, e.g., 0.95 = 95% of target) */
  upgradeThreshold?: number;
  /** Minimum time between quality changes (ms) */
  cooldownMs?: number;
  /** Number of consecutive frames below threshold before downgrade */
  downgradeFrameCount?: number;
  /** Number of consecutive frames above threshold before upgrade */
  upgradeFrameCount?: number;
  /** Enable console logging of quality changes */
  enableLogging?: boolean;
}

const DEFAULT_CONFIG: Required<QualityControllerConfig> = {
  autoAdjustEnabled: false, // Disabled by default, user must opt-in
  fpsHistorySize: 60,
  downgradeThreshold: 0.7,
  upgradeThreshold: 0.95,
  cooldownMs: 5000,
  downgradeFrameCount: 30,
  upgradeFrameCount: 120,
  enableLogging: true,
};

/**
 * Adaptive Quality Controller
 *
 * Monitors FPS and automatically adjusts graphics quality to maintain playable frame rates.
 *
 * Features:
 * - Tracks rolling average FPS over configurable window
 * - Automatically downgrades features when FPS drops below threshold
 * - Can upgrade features when FPS is consistently above target
 * - Hysteresis prevents rapid oscillation between quality levels
 * - Event-based notification of quality changes for other systems to respond
 *
 * Usage:
 * ```typescript
 * const qc = QualityController.getInstance();
 * qc.setAutoAdjust(true);
 *
 * // In render loop:
 * qc.recordFrame(deltaTimeMs);
 *
 * // Listen for changes:
 * qc.addEventListener((event) => {
 *   if (!event.currentFeatures.shadows) {
 *     disableShadows();
 *   }
 * });
 *
 * // Get current features:
 * const features = qc.getFeatures();
 * if (features.bloom) {
 *   enableBloomPass();
 * }
 * ```
 */
export class QualityController {
  private static instance: QualityController | null = null;

  private config: Required<QualityControllerConfig>;
  private baseSetting: GraphicsSettings;
  private currentFeatures: QualityFeatures;
  private degradationLevel: number = 0; // 0 = no degradation, higher = more features disabled

  // FPS tracking
  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private lastFrameTime: number = 0;

  // Hysteresis state
  private lastQualityChangeTime: number = 0;
  private consecutiveLowFrames: number = 0;
  private consecutiveHighFrames: number = 0;

  // Event listeners
  private listeners: Set<QualityEventListener> = new Set();

  private constructor(config: QualityControllerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseSetting = GRAPHICS_SETTING;
    this.currentFeatures = { ...QUALITY_PRESETS[this.baseSetting] };
    this.lastFrameTime = performance.now();
  }

  /**
   * Get the singleton instance of QualityController
   */
  static getInstance(config?: QualityControllerConfig): QualityController {
    if (!QualityController.instance) {
      QualityController.instance = new QualityController(config);
    }
    return QualityController.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    QualityController.instance = null;
  }

  /**
   * Enable or disable automatic quality adjustment
   */
  setAutoAdjust(enabled: boolean): void {
    this.config.autoAdjustEnabled = enabled;
    if (this.config.enableLogging) {
      console.log(`[QualityController] Auto-adjust ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Check if auto-adjust is enabled
   */
  isAutoAdjustEnabled(): boolean {
    return this.config.autoAdjustEnabled;
  }

  /**
   * Record a frame for FPS tracking.
   * Call this once per frame in the render loop.
   *
   * @param deltaTimeMs - Time since last frame in milliseconds
   */
  recordFrame(deltaTimeMs: number): void {
    const now = performance.now();
    const fps = deltaTimeMs > 0 ? 1000 / deltaTimeMs : 60;

    // Update history
    this.fpsHistory.push(fps);
    this.frameTimeHistory.push(deltaTimeMs);

    if (this.fpsHistory.length > this.config.fpsHistorySize) {
      this.fpsHistory.shift();
      this.frameTimeHistory.shift();
    }

    this.lastFrameTime = now;

    // Check for quality adjustment
    if (this.config.autoAdjustEnabled && this.fpsHistory.length >= this.config.fpsHistorySize / 2) {
      this.checkAndAdjustQuality();
    }
  }

  /**
   * Get the current average FPS
   */
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  /**
   * Get the current target FPS based on base setting
   */
  getTargetFPS(): number {
    return QUALITY_PRESETS[this.baseSetting].targetFPS;
  }

  /**
   * Get the current quality features
   */
  getFeatures(): Readonly<QualityFeatures> {
    return this.currentFeatures;
  }

  /**
   * Get the base graphics setting (user-selected)
   */
  getBaseSetting(): GraphicsSettings {
    return this.baseSetting;
  }

  /**
   * Get the current degradation level (0 = none)
   */
  getDegradationLevel(): number {
    return this.degradationLevel;
  }

  /**
   * Get diagnostic information
   */
  getDiagnostics(): {
    avgFPS: number;
    targetFPS: number;
    degradationLevel: number;
    maxDegradationLevel: number;
    autoAdjustEnabled: boolean;
    consecutiveLowFrames: number;
    consecutiveHighFrames: number;
    timeSinceLastChange: number;
  } {
    return {
      avgFPS: this.getAverageFPS(),
      targetFPS: this.getTargetFPS(),
      degradationLevel: this.degradationLevel,
      maxDegradationLevel: DEGRADATION_STEPS.length,
      autoAdjustEnabled: this.config.autoAdjustEnabled,
      consecutiveLowFrames: this.consecutiveLowFrames,
      consecutiveHighFrames: this.consecutiveHighFrames,
      timeSinceLastChange: performance.now() - this.lastQualityChangeTime,
    };
  }

  /**
   * Add an event listener for quality changes
   */
  addEventListener(listener: QualityEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: QualityEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Manually set a specific feature value
   */
  setFeature<K extends keyof QualityFeatures>(feature: K, value: QualityFeatures[K]): void {
    const previous = { ...this.currentFeatures };
    this.currentFeatures[feature] = value;
    this.emitEvent({
      type: "quality-change",
      previousFeatures: previous,
      currentFeatures: { ...this.currentFeatures },
      reason: "manual",
      changedFeature: feature,
      description: `Manually set ${feature} to ${value}`,
    });
  }

  /**
   * Reset to the base preset (user's selected quality level)
   */
  reset(): void {
    const previous = { ...this.currentFeatures };
    this.currentFeatures = { ...QUALITY_PRESETS[this.baseSetting] };
    this.degradationLevel = 0;
    this.consecutiveLowFrames = 0;
    this.consecutiveHighFrames = 0;

    this.emitEvent({
      type: "quality-change",
      previousFeatures: previous,
      currentFeatures: { ...this.currentFeatures },
      reason: "reset",
      description: `Reset to ${this.baseSetting} preset`,
    });

    if (this.config.enableLogging) {
      console.log(`[QualityController] Reset to ${this.baseSetting} preset`);
    }
  }

  /**
   * Force a downgrade step (for testing or manual control)
   */
  forceDowngrade(): boolean {
    return this.downgrade();
  }

  /**
   * Force an upgrade step (for testing or manual control)
   */
  forceUpgrade(): boolean {
    return this.upgrade();
  }

  /**
   * Check FPS and adjust quality if needed
   */
  private checkAndAdjustQuality(): void {
    const now = performance.now();
    const avgFPS = this.getAverageFPS();
    const targetFPS = this.getTargetFPS();
    const lowThreshold = targetFPS * this.config.downgradeThreshold;
    const highThreshold = targetFPS * this.config.upgradeThreshold;

    // Check if we're in cooldown
    const inCooldown = now - this.lastQualityChangeTime < this.config.cooldownMs;

    if (avgFPS < lowThreshold) {
      this.consecutiveLowFrames++;
      this.consecutiveHighFrames = 0;

      if (!inCooldown && this.consecutiveLowFrames >= this.config.downgradeFrameCount) {
        if (this.downgrade()) {
          this.lastQualityChangeTime = now;
          this.consecutiveLowFrames = 0;
        }
      }
    } else if (avgFPS > highThreshold) {
      this.consecutiveHighFrames++;
      this.consecutiveLowFrames = 0;

      if (!inCooldown && this.consecutiveHighFrames >= this.config.upgradeFrameCount) {
        if (this.upgrade()) {
          this.lastQualityChangeTime = now;
          this.consecutiveHighFrames = 0;
        }
      }
    } else {
      // FPS is acceptable, slowly decay counters
      this.consecutiveLowFrames = Math.max(0, this.consecutiveLowFrames - 1);
      this.consecutiveHighFrames = Math.max(0, this.consecutiveHighFrames - 1);
    }
  }

  /**
   * Downgrade quality by one step
   */
  private downgrade(): boolean {
    if (this.degradationLevel >= DEGRADATION_STEPS.length) {
      if (this.config.enableLogging) {
        console.log("[QualityController] Already at minimum quality, cannot downgrade further");
      }
      return false;
    }

    const step = DEGRADATION_STEPS[this.degradationLevel];
    const previous = { ...this.currentFeatures };

    // Apply the degradation
    (this.currentFeatures as Record<string, unknown>)[step.feature] = step.value;
    this.degradationLevel++;

    this.emitEvent({
      type: "quality-change",
      previousFeatures: previous,
      currentFeatures: { ...this.currentFeatures },
      reason: "auto-downgrade",
      changedFeature: step.feature,
      description: step.description,
    });

    if (this.config.enableLogging) {
      console.log(
        `[QualityController] Downgrade (${this.degradationLevel}/${DEGRADATION_STEPS.length}): ${step.description}`,
      );
    }

    return true;
  }

  /**
   * Upgrade quality by one step (reverse degradation)
   */
  private upgrade(): boolean {
    if (this.degradationLevel <= 0) {
      return false; // Already at base quality
    }

    this.degradationLevel--;
    const step = DEGRADATION_STEPS[this.degradationLevel];
    const previous = { ...this.currentFeatures };

    // Restore the feature to its base preset value
    const baseValue = QUALITY_PRESETS[this.baseSetting][step.feature];
    (this.currentFeatures as Record<string, unknown>)[step.feature] = baseValue;

    this.emitEvent({
      type: "quality-change",
      previousFeatures: previous,
      currentFeatures: { ...this.currentFeatures },
      reason: "auto-upgrade",
      changedFeature: step.feature,
      description: `Restored ${step.feature} to ${baseValue}`,
    });

    if (this.config.enableLogging) {
      console.log(
        `[QualityController] Upgrade (${this.degradationLevel}/${DEGRADATION_STEPS.length}): Restored ${step.feature}`,
      );
    }

    return true;
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: QualityChangeEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[QualityController] Error in event listener:", error);
      }
    });
  }
}

// Export singleton accessor
export const qualityController = QualityController.getInstance();

// Export preset for external use
export { QUALITY_PRESETS };
