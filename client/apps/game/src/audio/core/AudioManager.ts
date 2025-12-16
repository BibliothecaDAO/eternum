import { AudioAsset, AudioCategory, AudioMetrics, AudioPlayOptions, AudioState } from "../types";
import { AudioPoolManager } from "./AudioPoolManager";

export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private categoryGainNodes: Map<AudioCategory, GainNode> = new Map();
  private audioAssets: Map<string, AudioAsset> = new Map();
  private loadedAudio: Map<string, AudioBuffer> = new Map();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private musicSources: Set<AudioBufferSourceNode> = new Set(); // Track music sources separately
  private musicGainNodes: Map<AudioBufferSourceNode, GainNode> = new Map();
  private sourceGainNodes: Map<AudioBufferSourceNode, GainNode> = new Map(); // Track ALL per-play gain nodes for cleanup
  private poolManager: AudioPoolManager | null = null;
  private state: AudioState;
  private static readonly STORAGE_KEY = "ETERNUM_AUDIO_SETTINGS";

  // Variation tracking to avoid immediate repeats
  private lastPlayedVariation: Map<string, number> = new Map();

  // Anti-spam: track last play time per asset to prevent rapid repeats
  private lastPlayTime: Map<string, number> = new Map();

  // Ramp duration for volume changes to prevent clicks/pops (in seconds)
  private static readonly VOLUME_RAMP_DURATION = 0.015; // 15ms

  // Minimum interval between repeated plays of the same sound (in milliseconds)
  private static readonly MIN_REPEAT_INTERVAL_MS = 50;

  private constructor() {
    this.state = this.loadPersistedState();
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private getDefaultState(): AudioState {
    return {
      masterVolume: 1.0,
      categoryVolumes: {
        [AudioCategory.MUSIC]: 0.4, // Reduced from 0.5 - background layer
        [AudioCategory.UI]: 0.5, // Reduced from 0.8 - clear but not overpowering
        [AudioCategory.RESOURCE]: 0.5, // Reduced from 0.6 - frequent actions
        [AudioCategory.BUILDING]: 0.5, // Reduced from 0.6 - frequent actions
        [AudioCategory.COMBAT]: 0.7, // Reduced from 0.8 - still important but not overpowering
        [AudioCategory.AMBIENT]: 0.3, // Reduced from 0.4 - subtle atmosphere
        [AudioCategory.ENVIRONMENT]: 0.45, // Reduced from 0.5 - weather effects
      },
      muted: false,
      spatialEnabled: true,
      qualityTier: "high",
    };
  }

  private loadPersistedState(): AudioState {
    try {
      const stored = localStorage.getItem(AudioManager.STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        return { ...this.getDefaultState(), ...parsedState };
      }
    } catch (error) {
      console.warn("Failed to load persisted audio settings:", error);
    }
    return this.getDefaultState();
  }

  private saveState(): void {
    try {
      localStorage.setItem(AudioManager.STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn("Failed to save audio settings:", error);
    }
  }

  async initialize(): Promise<void> {
    if (this.audioContext) return;

    try {
      this.audioContext = new AudioContext();
      this.poolManager = new AudioPoolManager(this.audioContext);
      this.setupAudioGraph();
      await this.resumeContext();
    } catch (error) {
      console.error("Failed to initialize AudioManager:", error);
      throw error;
    }
  }

  private setupAudioGraph(): void {
    if (!this.audioContext) return;

    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
    this.masterGainNode.gain.value = this.state.masterVolume;

    Object.values(AudioCategory).forEach((category) => {
      const gainNode = this.audioContext!.createGain();
      gainNode.connect(this.masterGainNode!);
      gainNode.gain.value = this.state.categoryVolumes[category];
      this.categoryGainNodes.set(category, gainNode);
    });
  }

  private async resumeContext(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * Smoothly ramp a gain node to a target value to prevent clicks/pops
   */
  private rampGain(gainNode: GainNode, targetValue: number): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    // Cancel any pending ramps and set current value as starting point
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetValue, now + AudioManager.VOLUME_RAMP_DURATION);
  }

  registerAsset(asset: AudioAsset): void {
    this.audioAssets.set(asset.id, asset);
  }

  /**
   * Register asset and pre-load its audio buffer into the pool
   */
  async registerAssetWithPreload(asset: AudioAsset): Promise<void> {
    this.audioAssets.set(asset.id, asset);

    // Pre-load high-priority assets (UI sounds, etc.)
    if (asset.priority >= 8 && this.poolManager) {
      try {
        const buffer = await this.loadAsset(asset.id);
        this.poolManager.registerAsset(asset, buffer);
      } catch (error) {
        console.warn(`Failed to pre-load asset ${asset.id}:`, error);
      }
    }
  }

  async loadAsset(assetId: string): Promise<AudioBuffer> {
    const cached = this.loadedAudio.get(assetId);
    const asset = this.audioAssets.get(assetId);

    if (!asset || !this.audioContext) {
      throw new Error(`Asset ${assetId} not found or AudioContext not initialized`);
    }

    if (cached) {
      // Ensure cached asset is registered with pool manager
      if (this.poolManager) {
        this.poolManager.registerAsset(asset, cached);
      }
      return cached;
    }

    try {
      const response = await fetch(asset.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.loadedAudio.set(assetId, audioBuffer);

      // Register with pool manager if available
      if (this.poolManager) {
        this.poolManager.registerAsset(asset, audioBuffer);
      }

      return audioBuffer;
    } catch (error) {
      throw new Error(`Failed to load audio asset ${assetId}: ${error}`);
    }
  }

  /**
   * Load audio buffer by URL (used for variations)
   * Caches by URL to avoid re-fetching
   */
  private async loadAudioByUrl(url: string): Promise<AudioBuffer> {
    const cached = this.loadedAudio.get(url);
    if (cached) {
      return cached;
    }

    if (!this.audioContext) {
      throw new Error("AudioContext not initialized");
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.loadedAudio.set(url, audioBuffer);
      return audioBuffer;
    } catch (error) {
      throw new Error(`Failed to load audio from ${url}: ${error}`);
    }
  }

  /**
   * Select a variation URL for an asset, avoiding immediate repeats
   * Returns the main asset URL if no variations exist
   */
  private selectVariationUrl(asset: AudioAsset): string {
    const variations = asset.variations;

    // No variations - use main URL
    if (!variations || variations.length === 0) {
      return asset.url;
    }

    // Single variation - always use it
    if (variations.length === 1) {
      return variations[0];
    }

    // Multiple variations - pick randomly but avoid immediate repeat
    const lastIndex = this.lastPlayedVariation.get(asset.id);
    let selectedIndex: number;

    if (lastIndex === undefined) {
      // First play - pick any
      selectedIndex = Math.floor(Math.random() * variations.length);
    } else {
      // Avoid the last played index
      const availableIndices = variations.map((_, i) => i).filter((i) => i !== lastIndex);
      selectedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }

    this.lastPlayedVariation.set(asset.id, selectedIndex);
    return variations[selectedIndex];
  }

  async play(assetId: string, options: AudioPlayOptions = {}): Promise<AudioBufferSourceNode | null> {
    // Silent no-op when muted or uninitialized - don't throw, just return null
    // This allows fire-and-forget calls without try/catch everywhere
    if (!this.audioContext || this.state.muted) {
      return null;
    }

    await this.resumeContext();

    const asset = this.audioAssets.get(assetId);
    if (!asset) {
      console.warn(`Audio asset ${assetId} not found`);
      return null;
    }

    // Anti-spam: skip if same sound played too recently (except for music which should always play)
    if (asset.category !== AudioCategory.MUSIC) {
      const now = performance.now();
      const lastTime = this.lastPlayTime.get(assetId) ?? 0;
      if (now - lastTime < AudioManager.MIN_REPEAT_INTERVAL_MS) {
        return null; // Skip rapid repeat
      }
      this.lastPlayTime.set(assetId, now);
    }

    // Select variation URL (or main URL if no variations)
    const selectedUrl = this.selectVariationUrl(asset);
    const hasVariations = asset.variations && asset.variations.length > 0;

    // Load the audio buffer
    const buffer = hasVariations ? await this.loadAudioByUrl(selectedUrl) : await this.loadAsset(assetId);

    // NOTE: Music exclusivity is now managed by MusicRouterProvider, not here.
    // This allows proper crossfade transitions where the provider fades out
    // the previous track before starting the new one. Previously, stopAllMusic()
    // was called here which killed sources mid-fade.

    // Try to get a pooled node first, fallback to creating new one
    // Note: Pooling is only used for assets without variations (pooled by assetId)
    let source: AudioBufferSourceNode;
    if (this.poolManager && !hasVariations) {
      const pooledNode = this.poolManager.getNode(assetId);
      if (pooledNode) {
        // Using pooled node - buffer already set
        source = pooledNode;
        source.loop = options.loop ?? asset.loop;
      } else {
        // Pool miss or no pool - create new node
        source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = options.loop ?? asset.loop;
      }
    } else {
      // No pool manager or has variations - create directly
      source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = options.loop ?? asset.loop;
    }

    const categoryGain = this.categoryGainNodes.get(asset.category);
    if (!categoryGain) {
      throw new Error(`Missing gain node for category ${asset.category}`);
    }

    const gainNode = this.audioContext.createGain();
    const finalVolume = (options.volume ?? asset.volume) * this.state.categoryVolumes[asset.category];
    const now = this.audioContext.currentTime;

    if (options.fadeInMs && options.fadeInMs > 0) {
      const rampDuration = options.fadeInMs / 1000;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(finalVolume, now + rampDuration);
    } else {
      gainNode.gain.setValueAtTime(finalVolume, now);
    }

    source.connect(gainNode);
    gainNode.connect(categoryGain);

    // Track gain node for cleanup (prevents WebAudio graph bloat)
    this.sourceGainNodes.set(source, gainNode);

    source.onended = () => {
      this.activeSources.delete(source);

      // Disconnect and cleanup the per-play gain node to prevent graph bloat
      const perPlayGain = this.sourceGainNodes.get(source);
      if (perPlayGain) {
        try {
          perPlayGain.disconnect();
        } catch {
          // Already disconnected, ignore
        }
        this.sourceGainNodes.delete(source);
      }

      if (asset.category === AudioCategory.MUSIC) {
        this.musicSources.delete(source);
        this.musicGainNodes.delete(source);
      }
      options.onComplete?.();
    };

    this.activeSources.add(source);
    if (asset.category === AudioCategory.MUSIC) {
      this.musicSources.add(source);
      this.musicGainNodes.set(source, gainNode);
    }

    source.start();

    return source;
  }

  stop(source: AudioBufferSourceNode): void {
    if (this.activeSources.has(source)) {
      try {
        source.stop();
      } catch (error) {
        console.warn("Failed to stop audio source", error);
      }
      this.activeSources.delete(source);
      this.musicSources.delete(source);

      // Disconnect the per-play gain node (all sounds, not just music)
      const perPlayGain = this.sourceGainNodes.get(source);
      if (perPlayGain) {
        try {
          perPlayGain.disconnect();
        } catch {
          // Already disconnected, ignore
        }
        this.sourceGainNodes.delete(source);
      }

      // Also cleanup music-specific tracking
      const musicGain = this.musicGainNodes.get(source);
      if (musicGain) {
        this.musicGainNodes.delete(source);
      }
    }
  }

  /**
   * Update volume on an active audio source (for dynamic volume control like fades)
   * Uses ramping to prevent clicks/pops
   */
  setSourceVolume(source: AudioBufferSourceNode, volume: number): void {
    const gainNode = this.sourceGainNodes.get(source);
    if (gainNode && this.audioContext) {
      this.rampGain(gainNode, Math.max(0, Math.min(1, volume)));
    }
  }

  stopAllMusic(): void {
    this.musicSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Ignore errors if source already stopped
      }
      this.activeSources.delete(source);

      // Cleanup per-play gain node
      const perPlayGain = this.sourceGainNodes.get(source);
      if (perPlayGain) {
        try {
          perPlayGain.disconnect();
        } catch {
          // Already disconnected, ignore
        }
        this.sourceGainNodes.delete(source);
      }
    });
    this.musicSources.clear();
    this.musicGainNodes.clear();
  }

  stopAll(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Ignore if already stopped
      }
    });
    this.activeSources.clear();
    this.musicSources.clear();

    // Disconnect ALL per-play gain nodes (not just music)
    this.sourceGainNodes.forEach((gainNode) => {
      try {
        gainNode.disconnect();
      } catch {
        // Already disconnected, ignore
      }
    });
    this.sourceGainNodes.clear();
    this.musicGainNodes.clear();
  }

  async fadeOutAndStopMusic(source: AudioBufferSourceNode, durationMs = 500): Promise<void> {
    const gainNode = this.musicGainNodes.get(source);

    if (!this.audioContext || !gainNode) {
      this.stop(source);
      return;
    }

    const durationSeconds = Math.max(durationMs, 0) / 1000;
    const now = this.audioContext.currentTime;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + durationSeconds);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, durationMs + 60);

      source.onended = () => {
        clearTimeout(timeout);
        resolve();
      };
    });

    this.stop(source);
  }

  setMasterVolume(volume: number): void {
    this.state.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode) {
      this.rampGain(this.masterGainNode, this.state.muted ? 0 : this.state.masterVolume);
    }
    this.saveState();
  }

  setCategoryVolume(category: AudioCategory, volume: number): void {
    this.state.categoryVolumes[category] = Math.max(0, Math.min(1, volume));
    const gainNode = this.categoryGainNodes.get(category);
    if (gainNode) {
      this.rampGain(gainNode, this.state.categoryVolumes[category]);
    }
    this.saveState();
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    if (this.masterGainNode) {
      this.rampGain(this.masterGainNode, muted ? 0 : this.state.masterVolume);
    }
    this.saveState();
  }

  getState(): Readonly<AudioState> {
    return { ...this.state };
  }

  isInitialized(): boolean {
    return this.audioContext !== null && this.audioContext.state !== "suspended";
  }

  getMetrics(): AudioMetrics {
    const memoryUsageMB = this.loadedAudio.size * 0.1; // Rough estimate
    const poolStats = this.poolManager?.getAggregatedStats();

    return {
      memoryUsageMB,
      activeInstances: this.activeSources.size,
      pooledInstances: poolStats?.totalAvailableNodes || 0,
      cacheHitRatio: this.loadedAudio.size > 0 ? 1 : 0, // All loaded assets are "cached"
      averageLatencyMs: 0, // Will be measured with performance tracking
    };
  }

  /**
   * Get detailed pool statistics for debugging
   */
  getPoolStats() {
    return this.poolManager?.getAllStats() || {};
  }

  /**
   * Optimize audio pools based on usage patterns
   */
  optimizePools(): void {
    this.poolManager?.optimizePools();
  }

  dispose(): void {
    this.stopAll();
    this.poolManager?.dispose();
    this.audioContext?.close();
    this.audioContext = null;
    this.poolManager = null;
    this.loadedAudio.clear();
    this.audioAssets.clear();
    this.musicSources.clear();
    this.musicGainNodes.clear();
    this.sourceGainNodes.clear();
    AudioManager.instance = null as any;
  }
}
