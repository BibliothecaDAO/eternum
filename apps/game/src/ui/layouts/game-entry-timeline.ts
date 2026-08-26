const GAME_ENTRY_TIMELINE_PREFIX = "game-entry";
const GAME_ENTRY_TIMELINE_EVENT = "game-entry:milestone";

export const GAME_ENTRY_TIMELINE_EVENT_NAME = GAME_ENTRY_TIMELINE_EVENT;

type GameEntryMilestone =
  | "modal-opened"
  | "entry-requested"
  | "destination-resolved"
  | "world-selection-started"
  | "world-selection-completed"
  | "world-profile-build-started"
  | "world-profile-build-completed"
  | "world-profile-resolved"
  | "world-selection-state-persisted"
  | "asset-prefetch-scheduled"
  | "bootstrap-started"
  | "setup-started"
  | "setup-completed"
  | "initial-sync-started"
  | "initial-sync-completed"
  | "renderer-init-started"
  | "renderer-init-completed"
  | "bootstrap-completed"
  | "entry-ready"
  | "enter-game-started"
  | "overlay-mounted"
  | "player-structures-synced"
  | "worldmap-navigation-started"
  | "worldmap-fetch-completed"
  | "worldmap-scene-ready"
  | "renderer-scene-ready"
  | "overlay-ready"
  | "overlay-dismissed"
  | "world-interactive";

type GameEntryTimelineRecord = {
  elapsedMs: number;
  name: GameEntryMilestone;
  timestamp: number;
};

type GameEntryWindow = Window &
  typeof globalThis & {
    __eternumGameEntryDurations?: Record<string, number>;
    __eternumGameEntryStartMs?: number;
    __eternumGameEntryTimeline?: GameEntryTimelineRecord[];
  };

const getGameEntryWindow = (): GameEntryWindow | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window as GameEntryWindow;
};

const getMarkName = (name: GameEntryMilestone) => `${GAME_ENTRY_TIMELINE_PREFIX}:${name}`;

export const startGameEntryTimeline = (): void => {
  const gameEntryWindow = getGameEntryWindow();
  if (!gameEntryWindow) {
    return;
  }

  gameEntryWindow.__eternumGameEntryStartMs = performance.now();
  gameEntryWindow.__eternumGameEntryDurations = {};
  gameEntryWindow.__eternumGameEntryTimeline = [];
  markGameEntryMilestone("modal-opened");
  markGameEntryMilestone("entry-requested");
};

export const markGameEntryMilestone = (name: GameEntryMilestone): void => {
  const gameEntryWindow = getGameEntryWindow();
  if (!gameEntryWindow) {
    return;
  }

  const timestamp = performance.now();
  // Lazy-initialize the start clock when the timeline wasn't explicitly
  // started — happens on hard-reload directly into a `/play` route, which
  // bypasses the landing-page entry path that calls `startGameEntryTimeline()`.
  // Without this fallback, every milestone was recording `elapsedMs = 0` and
  // the boot debug panel rendered useless data for the most-instrumented case.
  if (gameEntryWindow.__eternumGameEntryStartMs === undefined) {
    gameEntryWindow.__eternumGameEntryStartMs = timestamp;
    gameEntryWindow.__eternumGameEntryDurations = gameEntryWindow.__eternumGameEntryDurations ?? {};
    gameEntryWindow.__eternumGameEntryTimeline = gameEntryWindow.__eternumGameEntryTimeline ?? [];
  }
  const startMs = gameEntryWindow.__eternumGameEntryStartMs;
  const record = {
    elapsedMs: Math.round(timestamp - startMs),
    name,
    timestamp,
  };

  const timeline = gameEntryWindow.__eternumGameEntryTimeline ?? [];
  if (timeline.some((entry) => entry.name === name)) {
    return;
  }
  timeline.push(record);
  gameEntryWindow.__eternumGameEntryTimeline = timeline;

  try {
    performance.mark(getMarkName(name));
  } catch {
    // Ignore duplicate or unsupported marks.
  }

  gameEntryWindow.dispatchEvent(
    new CustomEvent(GAME_ENTRY_TIMELINE_EVENT, {
      detail: record,
    }),
  );
};

export const recordGameEntryDuration = (name: string, durationMs: number): void => {
  const gameEntryWindow = getGameEntryWindow();
  if (!gameEntryWindow) {
    return;
  }

  const durations = gameEntryWindow.__eternumGameEntryDurations ?? {};
  durations[name] = Math.round(durationMs);
  gameEntryWindow.__eternumGameEntryDurations = durations;
};

export type GameEntryTimelineSnapshot = {
  /** Milestones recorded so far, ordered by occurrence. */
  milestones: ReadonlyArray<GameEntryTimelineRecord>;
  /** Named operation durations recorded via `recordGameEntryDuration` (ms). */
  durations: Readonly<Record<string, number>>;
  /** Wallclock ms since `startGameEntryTimeline()` first fired, or null if not started. */
  elapsedMs: number | null;
};

/**
 * Read the current timeline snapshot — used by the boot debug panel and
 * any diagnostic that wants to see "what's happening right now" without
 * re-implementing the window-globals plumbing.
 */
export const getGameEntryTimelineSnapshot = (): GameEntryTimelineSnapshot => {
  const gameEntryWindow = getGameEntryWindow();
  if (!gameEntryWindow) {
    return { milestones: [], durations: {}, elapsedMs: null };
  }

  const startMs = gameEntryWindow.__eternumGameEntryStartMs ?? null;
  return {
    milestones: gameEntryWindow.__eternumGameEntryTimeline ?? [],
    durations: gameEntryWindow.__eternumGameEntryDurations ?? {},
    elapsedMs: startMs === null ? null : Math.round(performance.now() - startMs),
  };
};
