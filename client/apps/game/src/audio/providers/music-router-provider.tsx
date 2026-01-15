import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { useLocation } from "react-router-dom";
import { MatchedRoutePlaylist, matchRoutePlaylist, PlaylistMode } from "../config/route-tracks";
import { useAudio } from "../hooks/useAudio";

type MusicStatus = "idle" | "loading" | "playing" | "error";

interface MusicRouterState {
  playlistKey: string | null;
  playlist: string[];
  playlistMode: PlaylistMode;
  currentIndex: number;
  currentTrackId: string | null;
  pendingTrackId: string | null;
  status: MusicStatus;
  error?: string | null;
  requiresInteraction: boolean;
  playRequestId: number;
  customTrackId: string | null;
}

type MusicRouterAction =
  | { type: "SET_PLAYLIST"; payload: MatchedRoutePlaylist }
  | { type: "REQUEST_TRACK"; trackId: string | null; index?: number }
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

const initialState: MusicRouterState = {
  playlistKey: null,
  playlist: [],
  playlistMode: "sequence",
  currentIndex: -1,
  currentTrackId: null,
  pendingTrackId: null,
  status: "idle",
  error: null,
  requiresInteraction: false,
  playRequestId: 0,
  customTrackId: null,
};

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const pickInitialIndex = (tracks: string[], mode: PlaylistMode) => {
  if (!tracks.length) return -1;
  if (mode === "shuffle") {
    return Math.floor(Math.random() * tracks.length);
  }
  return 0;
};

const pickNextIndex = (state: MusicRouterState) => {
  if (!state.playlist.length) return -1;
  if (state.playlistMode === "shuffle") {
    if (state.playlist.length === 1) return 0;
    let next = Math.floor(Math.random() * state.playlist.length);
    if (next === state.currentIndex) {
      next = (next + 1) % state.playlist.length;
    }
    return next;
  }
  return (state.currentIndex + 1) % state.playlist.length;
};

const musicRouterReducer = (state: MusicRouterState, action: MusicRouterAction): MusicRouterState => {
  switch (action.type) {
    case "SET_PLAYLIST": {
      const { key, tracks, mode } = action.payload;

      if (!tracks.length) {
        return {
          ...state,
          playlistKey: key,
          playlist: [],
          playlistMode: mode,
          currentIndex: -1,
          pendingTrackId: null,
        };
      }

      const samePlaylist =
        state.playlistKey === key && state.playlistMode === mode && arraysEqual(state.playlist, tracks);

      if (samePlaylist) {
        return state;
      }

      if (state.currentTrackId && tracks.includes(state.currentTrackId)) {
        return {
          ...state,
          playlistKey: key,
          playlist: tracks,
          playlistMode: mode,
          currentIndex: tracks.indexOf(state.currentTrackId),
        };
      }

      const initialIndex = pickInitialIndex(tracks, mode);
      const nextTrack = state.customTrackId ?? tracks[initialIndex] ?? null;

      return {
        ...state,
        playlistKey: key,
        playlist: tracks,
        playlistMode: mode,
        currentIndex: initialIndex,
        pendingTrackId: nextTrack,
        status: nextTrack ? "loading" : "idle",
        playRequestId: nextTrack ? state.playRequestId + 1 : state.playRequestId,
        error: null,
      };
    }
    case "REQUEST_TRACK":
      return {
        ...state,
        currentIndex: action.index ?? state.currentIndex,
        pendingTrackId: action.trackId,
        status: action.trackId ? "loading" : "idle",
        playRequestId: action.trackId ? state.playRequestId + 1 : state.playRequestId,
        error: null,
      };
    case "PLAYING":
      return {
        ...state,
        currentTrackId: action.trackId,
        pendingTrackId: null,
        status: "playing",
        error: null,
      };
    case "ADVANCE": {
      const nextIndex = pickNextIndex(state);
      if (nextIndex === -1) {
        return {
          ...state,
          pendingTrackId: null,
          status: "idle",
          customTrackId: null,
        };
      }

      const nextTrack = state.playlist[nextIndex] ?? null;

      return {
        ...state,
        currentIndex: nextIndex,
        pendingTrackId: nextTrack,
        status: nextTrack ? "loading" : "idle",
        playRequestId: nextTrack ? state.playRequestId + 1 : state.playRequestId,
        customTrackId: null,
        error: null,
      };
    }
    case "ERROR":
      return {
        ...state,
        status: "error",
        error: action.message ?? "Failed to play music",
      };
    case "SET_REQUIRES_INTERACTION":
      return {
        ...state,
        requiresInteraction: action.value,
      };
    case "SET_CUSTOM_TRACK": {
      const trackId = action.trackId;
      if (!trackId) {
        return {
          ...state,
          customTrackId: null,
        };
      }

      return {
        ...state,
        customTrackId: trackId,
        pendingTrackId: trackId,
        status: "loading",
        playRequestId: state.playRequestId + 1,
        error: null,
      };
    }
    default:
      return state;
  }
};

const formatTrackDisplayName = (trackId: string | null) => {
  if (!trackId) return "Silence";
  return trackId
    .replace("music.", "")
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const MUSIC_FADE_DURATION_MS = 800;

export const MusicRouterProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { ensureReady, play, audioState, isReady, fadeOutAndStopMusic } = useAudio();
  const [state, dispatch] = useReducer(musicRouterReducer, initialState);
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
