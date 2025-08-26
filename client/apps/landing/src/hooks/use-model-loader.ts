import { useCallback, useEffect, useRef, useState } from "react";
import { 
  modelLoaderService, 
  LoadedModel, 
  ModelCacheEntry, 
  ModelLoadProgress 
} from "@/services/model-loader-service";

export interface UseModelLoaderResult {
  model: LoadedModel | undefined;
  isLoading: boolean;
  error: string | undefined;
  progress: ModelLoadProgress | undefined;
  loadModel: () => Promise<LoadedModel | undefined>;
}

export interface UseModelLoaderOptions {
  modelPath: string;
  autoLoad?: boolean;
}

/**
 * React hook for loading individual 3D models with caching
 */
export const useModelLoader = ({ 
  modelPath, 
  autoLoad = false 
}: UseModelLoaderOptions): UseModelLoaderResult => {
  const [cacheEntry, setCacheEntry] = useState<ModelCacheEntry>(() => 
    modelLoaderService.getModelStatus(modelPath)
  );
  const intervalRef = useRef<NodeJS.Timeout>();

  // Poll for cache updates while loading
  useEffect(() => {
    const pollStatus = () => {
      const status = modelLoaderService.getModelStatus(modelPath);
      setCacheEntry(status);

      // Stop polling when loading is complete
      if (status.status !== 'loading') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      }
    };

    // Initial status check
    pollStatus();

    // Start polling if loading
    if (cacheEntry.status === 'loading') {
      intervalRef.current = setInterval(pollStatus, 100);
    }

    // Cleanup interval on unmount or when modelPath changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [modelPath, cacheEntry.status]);

  // Auto-load model if requested
  useEffect(() => {
    if (autoLoad && cacheEntry.status === 'idle') {
      modelLoaderService.loadModel(modelPath).catch(() => {
        // Error is handled by the service and reflected in cache
      });
    }
  }, [modelPath, autoLoad, cacheEntry.status]);

  const loadModel = useCallback(async (): Promise<LoadedModel | undefined> => {
    try {
      return await modelLoaderService.loadModel(modelPath);
    } catch (error) {
      console.error(`Failed to load model ${modelPath}:`, error);
      return undefined;
    }
  }, [modelPath]);

  return {
    model: cacheEntry.model,
    isLoading: cacheEntry.status === 'loading',
    error: cacheEntry.error,
    progress: cacheEntry.progress,
    loadModel,
  };
};

export interface UseModelPreloaderResult {
  preloadModels: (modelPaths: string[]) => Promise<void>;
  isPreloading: boolean;
  preloadProgress: Map<string, ModelLoadProgress>;
  preloadedCount: number;
  totalCount: number;
  preloadErrors: string[];
}

/**
 * React hook for preloading multiple 3D models
 */
export const useModelPreloader = (): UseModelPreloaderResult => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<Map<string, ModelLoadProgress>>(new Map());
  const [preloadedCount, setPreloadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [preloadErrors, setPreloadErrors] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  const preloadModels = useCallback(async (modelPaths: string[]) => {
    if (modelPaths.length === 0) return;

    setIsPreloading(true);
    setTotalCount(modelPaths.length);
    setPreloadedCount(0);
    setPreloadErrors([]);
    setPreloadProgress(new Map());

    // Start polling for progress updates
    const startProgressPolling = () => {
      intervalRef.current = setInterval(() => {
        const progress = modelLoaderService.getLoadingProgress();
        setPreloadProgress(new Map(progress));

        // Count completed models
        let completed = 0;
        const errors: string[] = [];
        
        for (const modelPath of modelPaths) {
          const status = modelLoaderService.getModelStatus(modelPath);
          if (status.status === 'loaded') {
            completed++;
          } else if (status.status === 'error') {
            completed++;
            if (status.error) {
              errors.push(`${modelPath}: ${status.error}`);
            }
          }
        }

        setPreloadedCount(completed);
        setPreloadErrors(errors);

        // Stop polling when all models are done loading
        if (completed === modelPaths.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
          setIsPreloading(false);
        }
      }, 100);
    };

    startProgressPolling();

    try {
      await modelLoaderService.preloadModels(modelPaths);
    } catch (error) {
      console.error('Preloading failed:', error);
    } finally {
      // Ensure polling stops
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      setIsPreloading(false);
    }
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    preloadModels,
    isPreloading,
    preloadProgress,
    preloadedCount,
    totalCount,
    preloadErrors,
  };
};

export interface UseChestModelPreloaderOptions {
  chestAssets: Array<{ modelPath: string; name: string }>;
  autoPreload?: boolean;
}

export interface UseChestModelPreloaderResult extends UseModelPreloaderResult {
  getModel: (modelPath: string) => LoadedModel | undefined;
  isModelReady: (modelPath: string) => boolean;
  modelLoadingStates: Map<string, ModelCacheEntry>;
}

/**
 * Specialized hook for preloading chest 3D models
 */
export const useChestModelPreloader = ({ 
  chestAssets, 
  autoPreload = true 
}: UseChestModelPreloaderOptions): UseChestModelPreloaderResult => {
  const preloaderResult = useModelPreloader();
  const [modelStates, setModelStates] = useState<Map<string, ModelCacheEntry>>(new Map());

  // Extract model paths from chest assets
  const modelPaths = chestAssets.map(asset => asset.modelPath);

  // Auto-preload models when component mounts
  useEffect(() => {
    if (autoPreload && modelPaths.length > 0) {
      preloaderResult.preloadModels(modelPaths);
    }
  }, [autoPreload, modelPaths.join(','), preloaderResult.preloadModels]);

  // Update model states periodically
  useEffect(() => {
    const updateStates = () => {
      const newStates = new Map<string, ModelCacheEntry>();
      for (const modelPath of modelPaths) {
        newStates.set(modelPath, modelLoaderService.getModelStatus(modelPath));
      }
      setModelStates(newStates);
    };

    updateStates();
    
    // Update states while preloading
    let interval: NodeJS.Timeout | undefined;
    if (preloaderResult.isPreloading) {
      interval = setInterval(updateStates, 200);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [modelPaths.join(','), preloaderResult.isPreloading]);

  const getModel = useCallback((modelPath: string): LoadedModel | undefined => {
    return modelLoaderService.getModel(modelPath);
  }, []);

  const isModelReady = useCallback((modelPath: string): boolean => {
    const status = modelLoaderService.getModelStatus(modelPath);
    return status.status === 'loaded';
  }, []);

  return {
    ...preloaderResult,
    getModel,
    isModelReady,
    modelLoadingStates: modelStates,
  };
};