import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioManager } from '../core/AudioManager';
import { AudioPlayOptions, AudioCategory } from '../types';
import { getAllAssets } from '../config/registry';

export function useAudio() {
  const managerRef = useRef<AudioManager>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        managerRef.current = AudioManager.getInstance();
        await managerRef.current.initialize();
        
        // Register all assets from registry
        const assets = getAllAssets();
        assets.forEach(asset => managerRef.current!.registerAsset(asset));
        
        console.log(`Audio system ready! Registered ${assets.length} audio assets`);
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize audio system:', error);
        setIsReady(false);
      }
    };

    initializeAudio();

    return () => {
      // Don't dispose here, let the manager persist across component unmounts
    };
  }, []);

  const play = useCallback(async (assetId: string, options?: AudioPlayOptions) => {
    if (!managerRef.current || !isReady) {
      console.warn('AudioManager not ready yet');
      return null;
    }

    try {
      return await managerRef.current.play(assetId, options);
    } catch (error) {
      console.error(`Failed to play audio ${assetId}:`, error);
      options?.onError?.(error as Error);
      return null;
    }
  }, [isReady]);

  const setMasterVolume = useCallback((volume: number) => {
    managerRef.current?.setMasterVolume(volume);
  }, []);

  // Moved setCategoryVolume and setMuted to return statement for immediate state updates

  const getState = useCallback(() => {
    return managerRef.current?.getState();
  }, []);

  const getMetrics = useCallback(() => {
    return managerRef.current?.getMetrics();
  }, []);

  // Simple reactive state management - no polling!
  const [audioState, setAudioState] = useState<ReturnType<typeof getState>>();

  useEffect(() => {
    if (isReady && managerRef.current) {
      setAudioState(managerRef.current.getState());
    }
  }, [isReady]);

  return {
    play,
    setMasterVolume,
    setCategoryVolume: useCallback((category: AudioCategory, volume: number) => {
      managerRef.current?.setCategoryVolume(category, volume);
      // Trigger immediate state update
      setAudioState(managerRef.current?.getState());
    }, []),
    setMuted: useCallback((muted: boolean) => {
      managerRef.current?.setMuted(muted);
      // Trigger immediate state update
      setAudioState(managerRef.current?.getState());
    }, []),
    getState,
    getMetrics,
    audioState, // Provide reactive state
    isReady
  };
}