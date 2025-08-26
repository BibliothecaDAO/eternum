import * as THREE from "three";
import { DRACOLoader, GLTF, GLTFLoader } from "three-stdlib";

export interface LoadedModel {
  gltf: GLTF;
  scene: THREE.Group;
}

export interface ModelLoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type ModelLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ModelCacheEntry {
  status: ModelLoadStatus;
  model?: LoadedModel;
  error?: string;
  progress?: ModelLoadProgress;
}

/**
 * Singleton service for loading and caching GLTF 3D models
 * Provides efficient model loading with caching to eliminate loading delays
 */
class ModelLoaderService {
  private static instance: ModelLoaderService;
  private cache = new Map<string, ModelCacheEntry>();
  private loader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private loadingPromises = new Map<string, Promise<LoadedModel>>();

  private constructor() {
    this.loader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  public static getInstance(): ModelLoaderService {
    if (!ModelLoaderService.instance) {
      ModelLoaderService.instance = new ModelLoaderService();
    }
    return ModelLoaderService.instance;
  }

  /**
   * Get the current status of a model
   */
  public getModelStatus(modelPath: string): ModelCacheEntry {
    return this.cache.get(modelPath) || { status: 'idle' };
  }

  /**
   * Get a loaded model if available
   */
  public getModel(modelPath: string): LoadedModel | undefined {
    const entry = this.cache.get(modelPath);
    return entry?.status === 'loaded' ? entry.model : undefined;
  }

  /**
   * Load a single model with caching
   */
  public async loadModel(modelPath: string): Promise<LoadedModel> {
    // Return cached model if available
    const cached = this.getModel(modelPath);
    if (cached) {
      return cached;
    }

    // Return existing promise if already loading
    const existingPromise = this.loadingPromises.get(modelPath);
    if (existingPromise) {
      return existingPromise;
    }

    // Initialize cache entry
    this.cache.set(modelPath, { status: 'loading' });

    // Create loading promise
    const loadingPromise = new Promise<LoadedModel>((resolve, reject) => {
      this.loader.load(
        modelPath,
        (gltf) => {
          // Clone the scene to avoid issues with multiple instances
          const scene = gltf.scene.clone();
          const loadedModel: LoadedModel = { gltf, scene };
          
          // Update cache
          this.cache.set(modelPath, { 
            status: 'loaded', 
            model: loadedModel 
          });
          
          // Clean up loading promise
          this.loadingPromises.delete(modelPath);
          
          resolve(loadedModel);
        },
        (progress) => {
          // Update loading progress
          const percentage = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
          this.cache.set(modelPath, {
            status: 'loading',
            progress: {
              loaded: progress.loaded,
              total: progress.total,
              percentage
            }
          });
        },
        (error) => {
          console.error(`Error loading model ${modelPath}:`, error);
          
          // Update cache with error
          this.cache.set(modelPath, { 
            status: 'error', 
            error: error.message || 'Failed to load model' 
          });
          
          // Clean up loading promise
          this.loadingPromises.delete(modelPath);
          
          reject(error);
        }
      );
    });

    // Store loading promise
    this.loadingPromises.set(modelPath, loadingPromise);

    return loadingPromise;
  }

  /**
   * Preload multiple models in parallel
   */
  public async preloadModels(modelPaths: string[]): Promise<Map<string, LoadedModel | Error>> {
    const results = new Map<string, LoadedModel | Error>();
    
    const loadPromises = modelPaths.map(async (modelPath) => {
      try {
        const model = await this.loadModel(modelPath);
        results.set(modelPath, model);
      } catch (error) {
        results.set(modelPath, error as Error);
      }
    });

    await Promise.allSettled(loadPromises);
    return results;
  }

  /**
   * Get loading progress for all currently loading models
   */
  public getLoadingProgress(): Map<string, ModelLoadProgress> {
    const progress = new Map<string, ModelLoadProgress>();
    
    for (const [modelPath, entry] of this.cache) {
      if (entry.status === 'loading' && entry.progress) {
        progress.set(modelPath, entry.progress);
      }
    }
    
    return progress;
  }

  /**
   * Clear specific model from cache
   */
  public clearModel(modelPath: string): void {
    const entry = this.cache.get(modelPath);
    if (entry?.model) {
      // Dispose of Three.js resources
      entry.model.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    
    this.cache.delete(modelPath);
    this.loadingPromises.delete(modelPath);
  }

  /**
   * Clear all cached models
   */
  public clearAll(): void {
    // Dispose of all models
    for (const modelPath of this.cache.keys()) {
      this.clearModel(modelPath);
    }
    
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    const stats = {
      total: this.cache.size,
      loaded: 0,
      loading: 0,
      error: 0,
      idle: 0
    };

    for (const entry of this.cache.values()) {
      stats[entry.status]++;
    }

    return stats;
  }

  /**
   * Cleanup resources when service is destroyed
   */
  public dispose(): void {
    this.clearAll();
    this.dracoLoader.dispose();
  }
}

// Export singleton instance
export const modelLoaderService = ModelLoaderService.getInstance();