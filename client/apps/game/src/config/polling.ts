const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const POLLING_INTERVALS = {
  playerStructuresMs: toNumber(import.meta.env.VITE_POLL_PLAYER_STRUCTURES_MS, 20_000),
  resourceArrivalsMs: toNumber(import.meta.env.VITE_POLL_RESOURCE_ARRIVALS_MS, 40_000),
  storyEventsMs: toNumber(import.meta.env.VITE_POLL_STORY_EVENTS_MS, 6_000),
  storyEventsStaleMs: toNumber(import.meta.env.VITE_POLL_STORY_EVENTS_STALE_MS, 60_000),
};
