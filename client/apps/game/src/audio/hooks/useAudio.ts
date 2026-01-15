import { useCallback, useEffect, useRef, useState } from "react";
import { getAllAssets } from "../config/registry";
import { AudioManager } from "../core/AudioManager";
import { AudioCategory, AudioPlayOptions } from "../types";

export function useAudio() {
  const managerRef = useRef<AudioManager>();
  const [isReady, setIsReady] = useState(false);
  const assetsRegisteredRef = useRef(false);

  const ensureReady = useCallback(async () => {
    try {
      managerRef.current = AudioManager.getInstance();

      if (!managerRef.current.isInitialized()) {
        await managerRef.current.initialize();
      }

      if (!assetsRegisteredRef.current) {
        const assets = getAllAssets();
        assets.forEach((asset) => managerRef.current!.registerAsset(asset));
        assetsRegisteredRef.current = true;
        console.log(`Audio system ready! Registered ${assets.length} audio assets`);
      }

      setIsReady(true);
      setAudioState(managerRef.current?.getState());
      return true;
    } catch (error) {
      console.error("Failed to initialize audio system:", error);
      setIsReady(false);
      throw error;
    }
  }, []);

  useEffect(() => {
    ensureReady().catch(() => {
      // Swallow to keep hook resilient; consumers can retry via ensureReady
    });

    return () => {
      // Don't dispose here, let the manager persist across component unmounts
    };
  }, [ensureReady]);

  const play = useCallback(
    async (assetId: string, options?: AudioPlayOptions) => {
      if (!managerRef.current || !isReady || !managerRef.current.isInitialized()) {
        try {
          await ensureReady();
        } catch (error) {
          console.warn("AudioManager not ready yet", error);
          options?.onError?.(error as Error);
          return null;
        }
      }

      try {
        return await managerRef?.current?.play(assetId, options);
      } catch (error) {
        console.error(`Failed to play audio ${assetId}:`, error);
        options?.onError?.(error as Error);
        return null;
      }
    },
    [ensureReady, isReady],
  );

  const setMasterVolume = useCallback((volume: number) => {
    managerRef.current?.setMasterVolume(volume);
    setAudioState(managerRef.current?.getState());
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

  const fadeOutAndStopMusic = useCallback(async (source: AudioBufferSourceNode, durationMs?: number) => {
    if (!managerRef.current) return;
    await managerRef.current.fadeOutAndStopMusic(source, durationMs);
    setAudioState(managerRef.current.getState());
  }, []);

  return {
    ensureReady,
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
    fadeOutAndStopMusic,
    getState,
    getMetrics,
    audioState, // Provide reactive state
    isReady,
  };
}
