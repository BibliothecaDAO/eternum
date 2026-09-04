// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  applyMatchedPlaylist,
  advancePlaylistTrack,
  createInitialMusicRouterState,
  selectCustomPlaylistTrack,
  syncPlayingTrack,
  type MusicRouterState,
} from "./music-router-state";

const buildState = (overrides: Partial<MusicRouterState> = {}): MusicRouterState => ({
  ...createInitialMusicRouterState(),
  ...overrides,
});

describe("music router state", () => {
  it("aligns manual track selection with the playlist index before advancing", () => {
    const leaderBoardState = applyMatchedPlaylist(
      buildState(),
      {
        key: "landing:leaderboard",
        mode: "sequence",
        tracks: ["music.rain_pool", "music.beyond_horizon"],
      },
      () => 0,
    );

    const customTrackState = selectCustomPlaylistTrack(leaderBoardState, "music.beyond_horizon");
    const playingCustomTrackState = syncPlayingTrack(customTrackState, "music.beyond_horizon");
    const advancedState = advancePlaylistTrack(playingCustomTrackState, () => 0);

    expect(advancedState.pendingTrackId).toBe("music.rain_pool");
    expect(advancedState.currentIndex).toBe(0);
  });

  it("drops a custom landing track when the next route uses a different playlist", () => {
    const leaderBoardState = syncPlayingTrack(
      selectCustomPlaylistTrack(
        applyMatchedPlaylist(
          buildState(),
          {
            key: "landing:leaderboard",
            mode: "sequence",
            tracks: ["music.rain_pool", "music.beyond_horizon"],
          },
          () => 0,
        ),
        "music.beyond_horizon",
      ),
      "music.beyond_horizon",
    );

    const playState = applyMatchedPlaylist(
      leaderBoardState,
      {
        key: "play:main",
        mode: "shuffle",
        tracks: ["music.shadow_song", "music.twilight_harvest", "music.strangers_arrival"],
      },
      () => 0,
    );

    expect(playState.pendingTrackId).toBe("music.shadow_song");
    expect(playState.customTrackId).toBeNull();
  });
});
