// Core exports
export { AudioManager } from "./core/AudioManager";
export { AudioPoolManager } from "./core/AudioPoolManager";
export { AudioPool } from "./core/AudioPool";

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

// Debug utilities
export { AudioDebugger } from "./utils/debug";

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
  
  // Separate high and low priority assets
  const highPriorityAssets = assets.filter(asset => asset.priority >= 8);
  const lowPriorityAssets = assets.filter(asset => asset.priority < 8);
  
  // Pre-load high-priority assets into pools
  const preloadPromises = highPriorityAssets.map(asset => 
    manager.registerAssetWithPreload(asset).catch(error => {
      console.warn(`Failed to pre-load ${asset.id}:`, error);
      // Fallback to regular registration
      manager.registerAsset(asset);
    })
  );
  
  await Promise.all(preloadPromises);
  
  // Register remaining assets normally
  lowPriorityAssets.forEach(asset => manager.registerAsset(asset));
  
  initialized = true;
}
