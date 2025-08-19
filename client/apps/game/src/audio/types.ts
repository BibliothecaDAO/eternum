export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface AudioAsset {
  id: string;
  url: string;
  category: AudioCategory;
  priority: number;
  poolSize: number;
  spatial: boolean;
  loop: boolean;
  volume: number;
  variations?: string[];
}

export enum AudioCategory {
  MUSIC = 'music',
  UI = 'ui',
  RESOURCE = 'resource', 
  BUILDING = 'building',
  COMBAT = 'combat',
  AMBIENT = 'ambient',
  ENVIRONMENT = 'environment'
}

export interface AudioPlayOptions {
  volume?: number;
  position?: Vector3;
  fadeInMs?: number;
  fadeOutMs?: number;
  loop?: boolean;
  priority?: number;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface SpatialAudioOptions {
  position: Vector3;
  maxDistance?: number;
  rolloffFactor?: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
}

export interface AudioState {
  masterVolume: number;
  categoryVolumes: Record<AudioCategory, number>;
  muted: boolean;
  spatialEnabled: boolean;
  qualityTier: 'low' | 'medium' | 'high';
}

export interface AudioMetrics {
  memoryUsageMB: number;
  activeInstances: number;
  pooledInstances: number;
  cacheHitRatio: number;
  averageLatencyMs: number;
}