import { MatchedRoutePlaylist, PlaylistMode } from "../config/route-tracks";

type MusicStatus = "idle" | "loading" | "playing" | "error";
type PlaylistIndexPicker = (length: number) => number;

export interface MusicRouterState {
  playlistKey: string | null;
  playlist: string[];
  playlistMode: PlaylistMode;
  currentIndex: number;
  currentTrackId: string | null;
  pendingTrackId: string | null;
  status: MusicStatus;
  error?: string | null;
  requiresInteraction: boolean;
  customTrackId: string | null;
}

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const pickRandomIndex = (length: number) => Math.floor(Math.random() * length);

const resolveInitialIndex = (tracks: string[], mode: PlaylistMode, pickIndex: PlaylistIndexPicker) => {
  if (!tracks.length) return -1;
  return mode === "shuffle" ? pickIndex(tracks.length) : 0;
};

const resolveNextIndex = (state: MusicRouterState, pickIndex: PlaylistIndexPicker) => {
  if (!state.playlist.length) return -1;

  if (state.playlistMode === "shuffle") {
    if (state.playlist.length === 1) return 0;

    let nextIndex = pickIndex(state.playlist.length);
    if (nextIndex === state.currentIndex) {
      nextIndex = (nextIndex + 1) % state.playlist.length;
    }

    return nextIndex;
  }

  return (state.currentIndex + 1) % state.playlist.length;
};

const findTrackIndex = (tracks: string[], trackId: string | null) => {
  if (!trackId) return -1;
  return tracks.indexOf(trackId);
};

export const createInitialMusicRouterState = (): MusicRouterState => ({
  playlistKey: null,
  playlist: [],
  playlistMode: "sequence",
  currentIndex: -1,
  currentTrackId: null,
  pendingTrackId: null,
  status: "idle",
  error: null,
  requiresInteraction: false,
  customTrackId: null,
});

export const applyMatchedPlaylist = (
  state: MusicRouterState,
  playlist: MatchedRoutePlaylist,
  pickIndex: PlaylistIndexPicker = pickRandomIndex,
): MusicRouterState => {
  const { key, tracks, mode } = playlist;

  if (!tracks.length) {
    return {
      ...state,
      playlistKey: key,
      playlist: [],
      playlistMode: mode,
      currentIndex: -1,
      pendingTrackId: null,
      customTrackId: null,
    };
  }

  const samePlaylist = state.playlistKey === key && state.playlistMode === mode && arraysEqual(state.playlist, tracks);
  if (samePlaylist) {
    return state;
  }

  const currentTrackIndex = findTrackIndex(tracks, state.currentTrackId);
  if (currentTrackIndex !== -1) {
    return {
      ...state,
      playlistKey: key,
      playlist: tracks,
      playlistMode: mode,
      currentIndex: currentTrackIndex,
      customTrackId: findTrackIndex(tracks, state.customTrackId) === -1 ? null : state.customTrackId,
    };
  }

  const retainedCustomTrackId = findTrackIndex(tracks, state.customTrackId) === -1 ? null : state.customTrackId;
  const initialIndex =
    retainedCustomTrackId !== null
      ? tracks.indexOf(retainedCustomTrackId)
      : resolveInitialIndex(tracks, mode, pickIndex);
  const nextTrackId = retainedCustomTrackId ?? tracks[initialIndex] ?? null;

  return {
    ...state,
    playlistKey: key,
    playlist: tracks,
    playlistMode: mode,
    currentIndex: initialIndex,
    pendingTrackId: nextTrackId,
    status: nextTrackId ? "loading" : "idle",
    error: null,
    customTrackId: retainedCustomTrackId,
  };
};

export const selectCustomPlaylistTrack = (state: MusicRouterState, trackId: string | null): MusicRouterState => {
  if (!trackId) {
    return {
      ...state,
      customTrackId: null,
    };
  }

  const selectedTrackIndex = findTrackIndex(state.playlist, trackId);

  return {
    ...state,
    currentIndex: selectedTrackIndex === -1 ? state.currentIndex : selectedTrackIndex,
    customTrackId: trackId,
    pendingTrackId: trackId,
    status: "loading",
    error: null,
  };
};

export const syncPlayingTrack = (state: MusicRouterState, trackId: string): MusicRouterState => {
  const currentTrackIndex = findTrackIndex(state.playlist, trackId);

  return {
    ...state,
    currentTrackId: trackId,
    currentIndex: currentTrackIndex === -1 ? state.currentIndex : currentTrackIndex,
    pendingTrackId: null,
    status: "playing",
    error: null,
  };
};

export const advancePlaylistTrack = (
  state: MusicRouterState,
  pickIndex: PlaylistIndexPicker = pickRandomIndex,
): MusicRouterState => {
  const nextIndex = resolveNextIndex(state, pickIndex);
  if (nextIndex === -1) {
    return {
      ...state,
      pendingTrackId: null,
      status: "idle",
      customTrackId: null,
    };
  }

  return {
    ...state,
    currentIndex: nextIndex,
    pendingTrackId: state.playlist[nextIndex] ?? null,
    status: "loading",
    customTrackId: null,
    error: null,
  };
};

export const markMusicPlaybackError = (state: MusicRouterState, message?: string): MusicRouterState => ({
  ...state,
  status: "error",
  error: message ?? "Failed to play music",
});
