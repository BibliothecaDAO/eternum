export const HERALD_DIRECTORY_PATH = "/games";
export const HERALD_UPDATES_PATH = `${HERALD_DIRECTORY_PATH}/updates`;
export const HERALD_MANIFEST_PATH = "/manifest";
export const HERALD_HEALTH_PATH = "/health";
export const HERALD_SNAPSHOT_PATH = /^\/games\/([0-9]+)\/snapshot$/;
export const HERALD_HISTORY_PATH = /^\/games\/([0-9]+)\/history$/;
export const HERALD_REVIEW_SNAPSHOT_PATH = /^\/games\/([0-9]+)\/review\/snapshot$/;
export const HERALD_DAY_RANKS_PATH = /^\/games\/([0-9]+)\/days\/([0-9]+)\/ranks$/;
export const HERALD_LEADERBOARD_PATH = /^\/games\/([0-9]+)\/leaderboard$/;
export const HERALD_ROSTER_PATH = /^\/games\/([0-9]+)\/aspects\/([0-9]+)\/members$/;
export const HERALD_SITE_PATH = /^\/games\/([0-9]+)\/sites\/([0-9]+)$/;
export const HERALD_STATS_PATH = /^\/games\/([0-9]+)\/stats$/;

export const HERALD_PUBLIC_GET_ROUTES: readonly (string | RegExp)[] = [
  HERALD_DIRECTORY_PATH,
  HERALD_UPDATES_PATH,
  HERALD_MANIFEST_PATH,
  HERALD_HEALTH_PATH,
  HERALD_SNAPSHOT_PATH,
  HERALD_HISTORY_PATH,
  HERALD_REVIEW_SNAPSHOT_PATH,
  HERALD_DAY_RANKS_PATH,
  HERALD_ROSTER_PATH,
  HERALD_SITE_PATH,
  HERALD_STATS_PATH,
];
