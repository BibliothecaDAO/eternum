import { Box3 } from "three";

import { evaluateChunkVisibilityAnomaly } from "./worldmap-zoom-hardening";

/** The only two refresh reasons the self-heal emits (both members of `WorldmapForceRefreshReason`). */
export type WorldmapTerrainRecoveryReason = "offscreen_chunk" | "terrain_self_heal";

export interface WorldmapTerrainVisibilityHealthMonitorDeps {
  isBoxVisible: (box: Box3) => boolean;
  getPresentedCellCount: () => number;
  requestChunkRefresh: (force: boolean, reason: WorldmapTerrainRecoveryReason) => number;
  waitForRequestedChunkRefresh: (token: number) => Promise<unknown>;
  emitTelemetry: (event: string, payload: Record<string, unknown>) => void;
  recordBoundsRecovery: () => void;
  now?: () => number;
}

export interface WorldmapTerrainVisibilityHealthMonitorConfig {
  selfHealEnabled: boolean;
  zeroTerrainFrameThreshold?: number;
  offscreenChunkFrameThreshold?: number;
  terrainRecoveryCooldownMs?: number;
}

/** The volatile scene facts the monitor reads each frame; everything else is injected once. */
export interface WorldmapTerrainVisibilityHealthTick {
  isWorldmapScene: boolean;
  isSwitchedOff: boolean;
  currentChunk: string;
  currentChunkBox: Box3 | null;
}

/**
 * Owns the terrain/chunk visibility self-heal: it watches whether the current chunk's bounds
 * stay onscreen and whether any terrain is presented, and forces a chunk refresh when either
 * fails past its frame threshold (rate-limited by a cooldown). How many cells are presented is
 * the terrain's own choice (the window it composes), so only none at all counts as lost. All
 * of the frame counters and the recovery-in-flight guard live here, not in the scene, so the
 * scene's runtime reset routes through {@link reset} (the single chokepoint).
 */
export class WorldmapTerrainVisibilityHealthMonitor {
  private zeroTerrainFrames = 0;
  private offscreenChunkFrames = 0;
  private presentedChunkKey: string | null = null;
  private terrainRecoveryInFlight = false;
  private lastTerrainRecoveryAtMs = 0;

  private readonly selfHealEnabled: boolean;
  private readonly zeroTerrainFrameThreshold: number;
  private readonly offscreenChunkFrameThreshold: number;
  private readonly terrainRecoveryCooldownMs: number;
  private readonly now: () => number;

  constructor(
    config: WorldmapTerrainVisibilityHealthMonitorConfig,
    private readonly deps: WorldmapTerrainVisibilityHealthMonitorDeps,
  ) {
    this.selfHealEnabled = config.selfHealEnabled;
    this.zeroTerrainFrameThreshold = config.zeroTerrainFrameThreshold ?? 3;
    this.offscreenChunkFrameThreshold = config.offscreenChunkFrameThreshold ?? 2;
    this.terrainRecoveryCooldownMs = config.terrainRecoveryCooldownMs ?? 1500;
    this.now = deps.now ?? (() => performance.now());
  }

  /** Resets only the per-frame counters; the chunk key and the cooldown timestamp persist. */
  private resetFrameCounters(): void {
    this.zeroTerrainFrames = 0;
    this.offscreenChunkFrames = 0;
  }

  /** Scene runtime reset: clears every counter and the recovery guard (the cooldown timestamp persists). */
  reset(): void {
    this.resetFrameCounters();
    this.presentedChunkKey = null;
    this.terrainRecoveryInFlight = false;
  }

  tick(input: WorldmapTerrainVisibilityHealthTick): void {
    if (!this.selfHealEnabled) {
      this.resetFrameCounters();
      return;
    }

    if (!input.isWorldmapScene || input.isSwitchedOff || input.currentChunk === "null" || !input.currentChunkBox) {
      this.resetFrameCounters();
      return;
    }

    const isCurrentChunkVisible = this.deps.isBoxVisible(input.currentChunkBox);
    const chunkVisibilityAnomaly = evaluateChunkVisibilityAnomaly({
      isCurrentChunkVisible,
      offscreenChunkFrames: this.offscreenChunkFrames,
      offscreenChunkFrameThreshold: this.offscreenChunkFrameThreshold,
    });
    this.offscreenChunkFrames = chunkVisibilityAnomaly.offscreenChunkFrames;

    if (!isCurrentChunkVisible) {
      this.recoverOffscreenChunk(input.currentChunk, chunkVisibilityAnomaly.shouldTriggerRecovery);
      return;
    }

    this.evaluatePresentedTerrain(input.currentChunk);
  }

  private recoverOffscreenChunk(currentChunk: string, shouldTriggerRecovery: boolean): void {
    this.zeroTerrainFrames = 0;

    if (!shouldTriggerRecovery) {
      return;
    }

    const now = this.now();
    if (this.terrainRecoveryInFlight || now - this.lastTerrainRecoveryAtMs < this.terrainRecoveryCooldownMs) {
      return;
    }

    this.lastTerrainRecoveryAtMs = now;
    this.terrainRecoveryInFlight = true;

    console.warn("[WorldMap] Current chunk bounds remained offscreen; forcing chunk refresh", {
      chunk: currentChunk,
      offscreenChunkFrames: this.offscreenChunkFrames,
    });
    this.deps.recordBoundsRecovery();
    this.deps.emitTelemetry("self_heal_start", {
      chunk: currentChunk,
      reason: "offscreen",
      offscreenChunkFrames: this.offscreenChunkFrames,
    });

    const refreshToken = this.deps.requestChunkRefresh(true, "offscreen_chunk");
    void this.deps
      .waitForRequestedChunkRefresh(refreshToken)
      .catch((error) => {
        console.error("[WorldMap] Offscreen chunk recovery failed:", error);
        this.deps.emitTelemetry("self_heal_failed", {
          chunk: currentChunk,
          reason: "offscreen",
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.deps.emitTelemetry("self_heal_complete", {
          chunk: currentChunk,
          reason: "offscreen",
        });
        this.terrainRecoveryInFlight = false;
        this.offscreenChunkFrames = 0;
      });
  }

  private evaluatePresentedTerrain(currentChunk: string): void {
    const presentedCells = this.deps.getPresentedCellCount();

    if (this.presentedChunkKey !== currentChunk) {
      this.presentedChunkKey = currentChunk;
      this.zeroTerrainFrames = 0;
      return;
    }

    this.zeroTerrainFrames = presentedCells === 0 ? this.zeroTerrainFrames + 1 : 0;
    if (this.zeroTerrainFrames < this.zeroTerrainFrameThreshold) return;

    const now = this.now();
    if (this.terrainRecoveryInFlight || now - this.lastTerrainRecoveryAtMs < this.terrainRecoveryCooldownMs) {
      return;
    }

    this.lastTerrainRecoveryAtMs = now;
    this.terrainRecoveryInFlight = true;

    console.warn("[WorldMap] No terrain presented; forcing chunk refresh", {
      chunk: currentChunk,
      zeroTerrainFrames: this.zeroTerrainFrames,
    });
    this.deps.recordBoundsRecovery();
    this.deps.emitTelemetry("self_heal_start", {
      chunk: currentChunk,
      reason: "zero",
      zeroTerrainFrames: this.zeroTerrainFrames,
    });

    const refreshToken = this.deps.requestChunkRefresh(true, "terrain_self_heal");
    void this.deps
      .waitForRequestedChunkRefresh(refreshToken)
      .catch((error) => {
        console.error("[WorldMap] Terrain visibility recovery failed:", error);
        this.deps.emitTelemetry("self_heal_failed", {
          chunk: currentChunk,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.deps.emitTelemetry("self_heal_complete", {
          chunk: currentChunk,
        });
        this.terrainRecoveryInFlight = false;
        this.zeroTerrainFrames = 0;
        this.offscreenChunkFrames = 0;
      });
  }
}
