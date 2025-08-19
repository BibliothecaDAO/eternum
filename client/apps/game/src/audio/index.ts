// Core exports
export { AudioManager } from "./core/AudioManager";

// Types
export type {
  AudioAsset,
  AudioMetrics,
  AudioPlayOptions,
  AudioState,
  SpatialAudioOptions,
  Vector3,
} from "./types";
export { AudioCategory } from "./types";

// Configuration
export { AUDIO_REGISTRY, getAllAssets, getAssetsByCategory, getAudioAsset } from "./config/registry";

// Hooks
export { useAudio } from "./hooks/useAudio";
export { useSimpleAudio } from "./hooks/useSimpleAudio";
export { useUISound } from "./hooks/useUISound";
export { usePlayResourceSound } from "./hooks/usePlayResourceSound";

// Components
export { useMusicPlayer, ScrollingTrackName } from "./components/MusicPlayer";

// Initialize and register all assets
import { getAllAssets } from "./config/registry";
import { AudioManager } from "./core/AudioManager";

let initialized = false;

export async function initializeAudioSystem(): Promise<void> {
  if (initialized) return;

  const manager = AudioManager.getInstance();
  await manager.initialize();

  // Register all assets from registry
  const assets = getAllAssets();
  assets.forEach((asset) => manager.registerAsset(asset));

  initialized = true;
}
