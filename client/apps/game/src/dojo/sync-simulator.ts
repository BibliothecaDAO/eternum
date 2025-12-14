/**
 * SyncSimulator - Simulates Torii sync traffic for performance testing
 *
 * This utility generates fake entity updates that flow through the same
 * sync pipeline as real blockchain data, allowing us to stress test:
 * - Queue processing performance
 * - Batch merging efficiency
 * - Worker thread throughput
 * - Main thread impact of setEntities calls
 *
 * Usage: Add to Performance GUI to simulate various sync loads
 */

import { type SetupResult } from "@bibliothecadao/dojo";
import { type Entity } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";

// Common model types that get synced frequently
const SIMULATED_MODEL_TYPES = [
  "s1_eternum-Army",
  "s1_eternum-Position",
  "s1_eternum-Health",
  "s1_eternum-Stamina",
  "s1_eternum-Resource",
  "s1_eternum-Building",
  "s1_eternum-Trade",
  "s1_eternum-Battle",
] as const;

type SimulatedModelType = (typeof SIMULATED_MODEL_TYPES)[number];

interface SyncSimulatorConfig {
  /** Entities per second to generate */
  entitiesPerSecond: number;
  /** Burst size (entities per burst) */
  burstSize: number;
  /** Mix of model types (weighted) */
  modelWeights: Partial<Record<SimulatedModelType, number>>;
  /** Whether to include deletions */
  includeDeletions: boolean;
  /** Deletion ratio (0-1) */
  deletionRatio: number;
  /** Logging enabled */
  logging: boolean;
  /** Whether to actually inject into the ECS (vs dry run) */
  injectIntoECS: boolean;
}

interface SimulatorStats {
  totalGenerated: number;
  totalUpserts: number;
  totalDeletions: number;
  totalInjected: number;
  startTime: number;
  lastBurstTime: number;
  lastInjectTime: number;
  averageInjectTime: number;
  peakInjectTime: number;
}

const DEFAULT_CONFIG: SyncSimulatorConfig = {
  entitiesPerSecond: 100,
  burstSize: 10,
  modelWeights: {
    "s1_eternum-Army": 3,
    "s1_eternum-Position": 5,
    "s1_eternum-Health": 2,
    "s1_eternum-Stamina": 2,
    "s1_eternum-Resource": 4,
    "s1_eternum-Building": 1,
    "s1_eternum-Trade": 2,
    "s1_eternum-Battle": 1,
  },
  includeDeletions: true,
  deletionRatio: 0.05,
  logging: false,
  injectIntoECS: true,
};

/**
 * Generate a random hex string for entity IDs
 */
function randomHexId(length: number = 64): string {
  const chars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate fake model data based on type
 */
function generateModelData(modelType: SimulatedModelType): Record<string, unknown> {
  switch (modelType) {
    case "s1_eternum-Army":
      return {
        entity_id: Math.floor(Math.random() * 100000),
        troops: {
          knight_count: Math.floor(Math.random() * 1000),
          paladin_count: Math.floor(Math.random() * 500),
          crossbowman_count: Math.floor(Math.random() * 800),
        },
        battle_id: Math.floor(Math.random() * 10000),
        battle_side: Math.floor(Math.random() * 2),
      };

    case "s1_eternum-Position":
      return {
        entity_id: Math.floor(Math.random() * 100000),
        x: Math.floor(Math.random() * 1000) - 500,
        y: Math.floor(Math.random() * 1000) - 500,
      };

    case "s1_eternum-Health":
      return {
        entity_id: Math.floor(Math.random() * 100000),
        current: Math.floor(Math.random() * 10000),
        lifetime: Math.floor(Math.random() * 10000),
      };

    case "s1_eternum-Stamina":
      return {
        entity_id: Math.floor(Math.random() * 100000),
        amount: Math.floor(Math.random() * 100),
        last_refill_tick: Math.floor(Date.now() / 1000),
      };

    case "s1_eternum-Resource":
      return {
        entity_id: Math.floor(Math.random() * 100000),
        resource_type: Math.floor(Math.random() * 30),
        balance: BigInt(Math.floor(Math.random() * 1000000)),
      };

    case "s1_eternum-Building":
      return {
        outer_col: Math.floor(Math.random() * 100),
        outer_row: Math.floor(Math.random() * 100),
        inner_col: Math.floor(Math.random() * 10),
        inner_row: Math.floor(Math.random() * 10),
        category: Math.floor(Math.random() * 10),
        bonus_percent: Math.floor(Math.random() * 50),
        entity_id: Math.floor(Math.random() * 100000),
        outer_entity_id: Math.floor(Math.random() * 100000),
        paused: Math.random() > 0.9,
      };

    case "s1_eternum-Trade":
      return {
        trade_id: Math.floor(Math.random() * 100000),
        maker_id: Math.floor(Math.random() * 100000),
        taker_id: Math.floor(Math.random() * 100000),
        maker_gives_resource_types: [Math.floor(Math.random() * 30)],
        maker_gives_resource_amounts: [BigInt(Math.floor(Math.random() * 10000))],
        taker_gives_resource_types: [Math.floor(Math.random() * 30)],
        taker_gives_resource_amounts: [BigInt(Math.floor(Math.random() * 10000))],
      };

    case "s1_eternum-Battle":
      return {
        battle_id: Math.floor(Math.random() * 10000),
        attack_army: Math.floor(Math.random() * 100000),
        defence_army: Math.floor(Math.random() * 100000),
        attackers_resources_escrow_id: Math.floor(Math.random() * 100000),
        defenders_resources_escrow_id: Math.floor(Math.random() * 100000),
        attack_army_lifetime: { troops: { knight_count: 100, paladin_count: 50, crossbowman_count: 80 } },
        defence_army_lifetime: { troops: { knight_count: 100, paladin_count: 50, crossbowman_count: 80 } },
        start_at: Math.floor(Date.now() / 1000) - 3600,
        duration_left: Math.floor(Math.random() * 3600),
      };

    default:
      return { entity_id: Math.floor(Math.random() * 100000) };
  }
}

/**
 * Select a random model type based on weights
 */
function selectModelType(weights: Partial<Record<SimulatedModelType, number>>): SimulatedModelType {
  const entries = Object.entries(weights) as [SimulatedModelType, number][];
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const [type, weight] of entries) {
    random -= weight;
    if (random <= 0) {
      return type;
    }
  }

  return entries[0][0];
}

interface GeneratedEntity {
  hashed_keys: string;
  models: Record<string, Record<string, unknown>>;
}

/**
 * Generate a fake Torii entity
 */
function generateFakeEntity(config: SyncSimulatorConfig, existingIds: Set<string>): GeneratedEntity {
  const isDeletion = config.includeDeletions && Math.random() < config.deletionRatio && existingIds.size > 0;

  if (isDeletion) {
    // Pick a random existing ID to delete
    const ids = Array.from(existingIds);
    const idToDelete = ids[Math.floor(Math.random() * ids.length)];
    existingIds.delete(idToDelete);
    return {
      hashed_keys: idToDelete,
      models: {}, // Empty models = deletion
    };
  }

  // Generate new or update existing
  const reuseExisting = existingIds.size > 0 && Math.random() < 0.3;
  let entityId: string;

  if (reuseExisting) {
    const ids = Array.from(existingIds);
    entityId = ids[Math.floor(Math.random() * ids.length)];
  } else {
    entityId = randomHexId();
    existingIds.add(entityId);
  }

  const modelType = selectModelType(config.modelWeights);
  const modelData = generateModelData(modelType);

  return {
    hashed_keys: entityId,
    models: {
      [modelType]: modelData,
    },
  };
}

export class SyncSimulator {
  private config: SyncSimulatorConfig;
  private stats: SimulatorStats;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private existingEntityIds: Set<string> = new Set();
  private setupResult: SetupResult | null = null;
  private injectTimeHistory: number[] = [];
  private readonly MAX_HISTORY = 100;

  constructor(config: Partial<SyncSimulatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.createEmptyStats();
  }

  private createEmptyStats(): SimulatorStats {
    return {
      totalGenerated: 0,
      totalUpserts: 0,
      totalDeletions: 0,
      totalInjected: 0,
      startTime: 0,
      lastBurstTime: 0,
      lastInjectTime: 0,
      averageInjectTime: 0,
      peakInjectTime: 0,
    };
  }

  /**
   * Initialize with the app's setup result to inject into real sync pipeline.
   * This is required for ECS injection to work.
   */
  initialize(setupResult: SetupResult): void {
    this.setupResult = setupResult;
    console.log("[SyncSimulator] Initialized with setup result - ECS injection enabled");
  }

  /**
   * Check if ECS injection is available
   */
  isECSAvailable(): boolean {
    return this.setupResult !== null;
  }

  /**
   * Start generating simulated sync traffic
   */
  start(): void {
    if (this.intervalId) {
      console.warn("[SyncSimulator] Already running");
      return;
    }

    if (this.config.injectIntoECS && !this.setupResult) {
      console.warn("[SyncSimulator] ECS injection enabled but setupResult not initialized. Running in dry-run mode.");
    }

    this.stats = this.createEmptyStats();
    this.stats.startTime = performance.now();
    this.existingEntityIds.clear();
    this.injectTimeHistory = [];

    const intervalMs = 1000 / (this.config.entitiesPerSecond / this.config.burstSize);

    console.log(
      `[SyncSimulator] Starting: ${this.config.entitiesPerSecond} entities/sec, burst size ${this.config.burstSize}, interval ${intervalMs.toFixed(1)}ms, ECS: ${this.config.injectIntoECS && this.setupResult ? "ON" : "OFF"}`,
    );

    this.intervalId = setInterval(() => {
      this.generateBurst();
    }, intervalMs);
  }

  /**
   * Stop generating traffic
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[SyncSimulator] Stopped");
      this.logStats();
    }
  }

  /**
   * Check if simulator is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncSimulatorConfig>): void {
    const wasRunning = this.isRunning();
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SyncSimulatorConfig {
    return { ...this.config };
  }

  /**
   * Get current stats
   */
  getStats(): SimulatorStats {
    return { ...this.stats };
  }

  /**
   * Generate a burst of entities
   */
  private generateBurst(): void {
    const burstStart = performance.now();
    const upserts: GeneratedEntity[] = [];
    const deletions: string[] = [];

    for (let i = 0; i < this.config.burstSize; i++) {
      const entity = generateFakeEntity(this.config, this.existingEntityIds);
      const isDeletion = Object.keys(entity.models).length === 0;

      if (isDeletion) {
        this.stats.totalDeletions++;
        deletions.push(entity.hashed_keys);
      } else {
        this.stats.totalUpserts++;
        upserts.push(entity);
      }
      this.stats.totalGenerated++;
    }

    // Inject into ECS if enabled and available
    if (this.config.injectIntoECS && this.setupResult) {
      this.injectBatch(upserts, deletions);
    }

    this.stats.lastBurstTime = performance.now() - burstStart;

    if (this.config.logging && this.stats.totalGenerated % 100 === 0) {
      this.logStats();
    }
  }

  /**
   * Inject a batch of entities into the ECS
   */
  private injectBatch(upserts: GeneratedEntity[], deletions: string[]): void {
    if (!this.setupResult) return;

    const injectStart = performance.now();

    try {
      const { world } = this.setupResult.network;

      // Process deletions
      if (deletions.length > 0) {
        deletions.forEach((entityId) => {
          world.deleteEntity(entityId as Entity);
        });
      }

      // Process upserts using setEntities (same as real sync)
      if (upserts.length > 0) {
        const modelsArray = upserts.map((entity) => ({
          hashed_keys: entity.hashed_keys,
          models: entity.models,
        }));

        // Call setEntities - this is the main performance bottleneck we're testing
        setEntities(modelsArray, world.components as any, false);
      }

      this.stats.totalInjected += upserts.length + deletions.length;
    } catch (error) {
      if (this.config.logging) {
        console.error("[SyncSimulator] Injection error:", error);
      }
    }

    const injectTime = performance.now() - injectStart;
    this.stats.lastInjectTime = injectTime;

    // Track injection time history for averages
    this.injectTimeHistory.push(injectTime);
    if (this.injectTimeHistory.length > this.MAX_HISTORY) {
      this.injectTimeHistory.shift();
    }

    this.stats.averageInjectTime =
      this.injectTimeHistory.reduce((a, b) => a + b, 0) / this.injectTimeHistory.length;
    this.stats.peakInjectTime = Math.max(this.stats.peakInjectTime, injectTime);
  }

  /**
   * Log current stats
   */
  logStats(): void {
    const elapsed = (performance.now() - this.stats.startTime) / 1000;
    const rate = elapsed > 0 ? this.stats.totalGenerated / elapsed : 0;

    console.log(`[SyncSimulator] Stats:
  Total: ${this.stats.totalGenerated} (${this.stats.totalUpserts} upserts, ${this.stats.totalDeletions} deletions)
  Injected: ${this.stats.totalInjected}
  Elapsed: ${elapsed.toFixed(1)}s
  Rate: ${rate.toFixed(1)} entities/sec (target: ${this.config.entitiesPerSecond})
  Last burst: ${this.stats.lastBurstTime.toFixed(2)}ms
  Inject time: last=${this.stats.lastInjectTime.toFixed(2)}ms, avg=${this.stats.averageInjectTime.toFixed(2)}ms, peak=${this.stats.peakInjectTime.toFixed(2)}ms
  Active entities: ${this.existingEntityIds.size}
  ECS: ${this.config.injectIntoECS && this.setupResult ? "ON" : "OFF"}`);
  }

  /**
   * Run a one-time burst for testing
   */
  burst(count: number = 100): void {
    if (!this.stats.startTime) {
      this.stats.startTime = performance.now();
    }
    console.log(`[SyncSimulator] Running one-time burst of ${count} entities`);
    const originalBurstSize = this.config.burstSize;
    this.config.burstSize = count;
    this.generateBurst();
    this.config.burstSize = originalBurstSize;
    this.logStats();
  }

  /**
   * Dispose of the simulator
   */
  dispose(): void {
    this.stop();
    this.existingEntityIds.clear();
    this.setupResult = null;
    this.injectTimeHistory = [];
  }
}

// Singleton instance for easy access from GUI
let simulatorInstance: SyncSimulator | null = null;

export function getSyncSimulator(): SyncSimulator {
  if (!simulatorInstance) {
    simulatorInstance = new SyncSimulator();
  }
  return simulatorInstance;
}

export function resetSyncSimulator(): void {
  if (simulatorInstance) {
    simulatorInstance.dispose();
    simulatorInstance = null;
  }
}

/**
 * Initialize the sync simulator with the app's setup result.
 * Call this after the app is initialized to enable ECS injection.
 */
export function initializeSyncSimulator(setupResult: SetupResult): void {
  getSyncSimulator().initialize(setupResult);
}
