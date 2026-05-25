import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { useLocation } from "react-router-dom";
import { MatchedRoutePlaylist, matchRoutePlaylist } from "../config/route-tracks";
import { useAudio } from "../hooks/useAudio";
import { formatTrackDisplayName } from "../shared/track-display";
import {
  advancePlaylistTrack,
  applyMatchedPlaylist,
  createInitialMusicRouterState,
  markMusicPlaybackError,
  MusicRouterState,
  selectCustomPlaylistTrack,
  syncPlayingTrack,
} from "./music-router-state";

type MusicStatus = MusicRouterState["status"];

type MusicRouterAction =
  | { type: "SET_PLAYLIST"; payload: MatchedRoutePlaylist }
  | { type: "PLAYING"; trackId: string }
  | { type: "ADVANCE" }
  | { type: "ERROR"; message?: string }
  | { type: "SET_REQUIRES_INTERACTION"; value: boolean }
  | { type: "SET_CUSTOM_TRACK"; trackId: string | null };

interface BackgroundMusicContextValue {
  currentTrackId: string | null;
  trackName: string;
  isReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  status: MusicStatus;
  requiresInteraction: boolean;
  playlistKey: string | null;
  playlist: string[];
  skip: () => void;
  setCustomTrack: (trackId: string | null) => void;
  requestStart: () => Promise<void>;
}

const BackgroundMusicContext = createContext<BackgroundMusicContextValue | undefined>(undefined);

const musicRouterReducer = (state: MusicRouterState, action: MusicRouterAction): MusicRouterState => {
  switch (action.type) {
    case "SET_PLAYLIST":
      return applyMatchedPlaylist(state, action.payload);
    case "PLAYING":
      return syncPlayingTrack(state, action.trackId);
    case "ADVANCE":
      return advancePlaylistTrack(state);
    case "ERROR":
      return markMusicPlaybackError(state, action.message);
    case "SET_REQUIRES_INTERACTION":
      return {
        ...state,
        requiresInteraction: action.value,
      };
    case "SET_CUSTOM_TRACK":
      return selectCustomPlaylistTrack(state, action.trackId);
    default:
      return state;
  }
};

const MUSIC_FADE_DURATION_MS = 800;

export const MusicRouterProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { ensureReady, play, audioState, isReady, fadeOutAndStopMusic } = useAudio();
  const [state, dispatch] = useReducer(musicRouterReducer, createInitialMusicRouterState());
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    dispatch({ type: "SET_REQUIRES_INTERACTION", value: !isReady });
  }, [isReady]);

  useEffect(() => {
    const playlist = matchRoutePlaylist(location.pathname);
    dispatch({ type: "SET_PLAYLIST", payload: playlist });
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch (error) {
          console.warn("Failed to stop music source on cleanup", error);
        }
      }
    };
  }, []);

  useEffect(() => {
    const pendingTrackId = state.pendingTrackId;
    if (!pendingTrackId) return;
    if (!isReady) return;
    if (audioState?.muted) return;

    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const playTrack = async () => {
      try {
        await ensureReady();

        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        const previousSource = sourceRef.current;
        if (previousSource && state.currentTrackId !== pendingTrackId) {
          fadeOutAndStopMusic(previousSource, MUSIC_FADE_DURATION_MS).catch((error) => {
            console.warn("Failed to fade out previous music source", error);
          });
          sourceRef.current = null;
        }

        const source = await play(pendingTrackId, {
          loop: false,
          fadeInMs: MUSIC_FADE_DURATION_MS,
          onComplete: () => {
            if (requestIdRef.current !== requestId) return;
            sourceRef.current = null;
            dispatch({ type: "ADVANCE" });
          },
        });

        if (!source) {
          if (!cancelled && requestIdRef.current === requestId) {
            dispatch({ type: "ERROR", message: "Audio source unavailable" });
          }
          return;
        }

        if (cancelled || requestIdRef.current !== requestId) {
          if (source) {
            fadeOutAndStopMusic(source, MUSIC_FADE_DURATION_MS).catch((error) => {
              console.warn("Failed to fade out aborted music source", error);
            });
          }
          return;
        }

        sourceRef.current = source;
        dispatch({ type: "PLAYING", trackId: pendingTrackId });
      } catch (error) {
        if (!cancelled && requestIdRef.current === requestId) {
          const message = error instanceof Error ? error.message : String(error);
          dispatch({ type: "ERROR", message });
        }
      }
    };

    playTrack();

    return () => {
      cancelled = true;
    };
  }, [audioState?.muted, ensureReady, fadeOutAndStopMusic, isReady, play, state.currentTrackId, state.pendingTrackId]);

  const skip = useCallback(() => {
    if (!state.playlist.length) return;
    if (sourceRef.current) {
      const currentSource = sourceRef.current;
      sourceRef.current = null;
      fadeOutAndStopMusic(currentSource, MUSIC_FADE_DURATION_MS).catch((error) => {
        console.warn("Failed to fade out source during skip", error);
      });
    }
    dispatch({ type: "ADVANCE" });
  }, [fadeOutAndStopMusic, state.playlist.length]);

  const setCustomTrack = useCallback((trackId: string | null) => {
    dispatch({ type: "SET_CUSTOM_TRACK", trackId });
  }, []);

  const requestStart = useCallback(async () => {
    try {
      await ensureReady();
      dispatch({ type: "SET_REQUIRES_INTERACTION", value: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dispatch({ type: "ERROR", message });
    }
  }, [ensureReady]);

  const value = useMemo<BackgroundMusicContextValue>(() => {
    const trackName = formatTrackDisplayName(state.currentTrackId);

    return {
      currentTrackId: state.currentTrackId,
      trackName,
      isReady,
      isPlaying: state.status === "playing",
      isMuted: audioState?.muted ?? false,
      status: state.status,
      requiresInteraction: state.requiresInteraction,
      playlistKey: state.playlistKey,
      playlist: state.playlist,
      skip,
      setCustomTrack,
      requestStart,
    };
  }, [audioState?.muted, isReady, requestStart, setCustomTrack, skip, state]);

  return <BackgroundMusicContext.Provider value={value}>{children}</BackgroundMusicContext.Provider>;
};

export const useBackgroundMusic = () => {
  const context = useContext(BackgroundMusicContext);
  if (!context) {
    throw new Error("useBackgroundMusic must be used within a MusicRouterProvider");
  }
  return context;
};
