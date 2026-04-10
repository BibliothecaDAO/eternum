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
  | "bootstrap-completed"
  | "session-policies-refresh-started"
  | "session-policies-refresh-completed"
  | "session-policies-refresh-skipped"
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
  const startMs = gameEntryWindow.__eternumGameEntryStartMs ?? timestamp;
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
