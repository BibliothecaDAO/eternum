import { AudioAsset, AudioCategory, AudioMetrics, AudioPlayOptions, AudioState } from "../types";

export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private categoryGainNodes: Map<AudioCategory, GainNode> = new Map();
  private audioAssets: Map<string, AudioAsset> = new Map();
  private loadedAudio: Map<string, AudioBuffer> = new Map();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private musicSources: Set<AudioBufferSourceNode> = new Set(); // Track music sources separately
  private state: AudioState;

  private constructor() {
    this.state = {
      masterVolume: 1.0,
      categoryVolumes: {
        [AudioCategory.MUSIC]: 0.5,
        [AudioCategory.UI]: 0.7,
        [AudioCategory.RESOURCE]: 0.6,
        [AudioCategory.BUILDING]: 0.6,
        [AudioCategory.COMBAT]: 0.8,
        [AudioCategory.AMBIENT]: 0.4,
        [AudioCategory.ENVIRONMENT]: 0.5,
      },
      muted: false,
      spatialEnabled: true,
      qualityTier: "high",
    };
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.audioContext) return;

    try {
      this.audioContext = new AudioContext();
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

  registerAsset(asset: AudioAsset): void {
    this.audioAssets.set(asset.id, asset);
  }

  async loadAsset(assetId: string): Promise<AudioBuffer> {
    const cached = this.loadedAudio.get(assetId);
    if (cached) return cached;

    const asset = this.audioAssets.get(assetId);
    if (!asset || !this.audioContext) {
      throw new Error(`Asset ${assetId} not found or AudioContext not initialized`);
    }

    try {
      const response = await fetch(asset.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.loadedAudio.set(assetId, audioBuffer);
      return audioBuffer;
    } catch (error) {
      throw new Error(`Failed to load audio asset ${assetId}: ${error}`);
    }
  }

  async play(assetId: string, options: AudioPlayOptions = {}): Promise<AudioBufferSourceNode> {
    if (!this.audioContext || this.state.muted) {
      throw new Error("AudioContext not available or muted");
    }

    await this.resumeContext();

    const buffer = await this.loadAsset(assetId);
    const asset = this.audioAssets.get(assetId)!;

    // If this is a music track, stop all existing music first
    if (asset.category === AudioCategory.MUSIC) {
      this.stopAllMusic();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? asset.loop;

    const gainNode = this.audioContext.createGain();
    const finalVolume = (options.volume ?? asset.volume) * this.state.categoryVolumes[asset.category];
    gainNode.gain.value = finalVolume;

    source.connect(gainNode);
    gainNode.connect(this.categoryGainNodes.get(asset.category)!);

    source.onended = () => {
      this.activeSources.delete(source);
      if (asset.category === AudioCategory.MUSIC) {
        this.musicSources.delete(source);
      }
      options.onComplete?.();
    };

    this.activeSources.add(source);
    if (asset.category === AudioCategory.MUSIC) {
      this.musicSources.add(source);
    }
    
    source.start();

    return source;
  }

  stop(source: AudioBufferSourceNode): void {
    if (this.activeSources.has(source)) {
      source.stop();
      this.activeSources.delete(source);
      this.musicSources.delete(source);
    }
  }

  stopAllMusic(): void {
    this.musicSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if source already stopped
      }
      this.activeSources.delete(source);
    });
    this.musicSources.clear();
  }

  stopAll(): void {
    this.activeSources.forEach((source) => source.stop());
    this.activeSources.clear();
    this.musicSources.clear();
  }

  setMasterVolume(volume: number): void {
    this.state.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = this.state.muted ? 0 : this.state.masterVolume;
    }
  }

  setCategoryVolume(category: AudioCategory, volume: number): void {
    this.state.categoryVolumes[category] = Math.max(0, Math.min(1, volume));
    const gainNode = this.categoryGainNodes.get(category);
    if (gainNode) {
      gainNode.gain.value = this.state.categoryVolumes[category];
    }
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = muted ? 0 : this.state.masterVolume;
    }
  }

  getState(): Readonly<AudioState> {
    return { ...this.state };
  }

  getMetrics(): AudioMetrics {
    const memoryUsageMB = this.loadedAudio.size * 0.1; // Rough estimate
    return {
      memoryUsageMB,
      activeInstances: this.activeSources.size,
      pooledInstances: 0, // Will be implemented with AudioPool
      cacheHitRatio: 0, // Will be tracked with usage metrics
      averageLatencyMs: 0, // Will be measured with performance tracking
    };
  }

  dispose(): void {
    this.stopAll();
    this.audioContext?.close();
    this.audioContext = null;
    this.loadedAudio.clear();
    this.audioAssets.clear();
    this.musicSources.clear();
    AudioManager.instance = null as any;
  }
}
