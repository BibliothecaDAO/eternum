const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const POLLING_INTERVALS = {
  storyEventsStaleMs: toNumber(import.meta.env.VITE_POLL_STORY_EVENTS_STALE_MS, 60_000),
  autoRegisterPointsMs: toNumber(import.meta.env.VITE_POLL_AUTO_REGISTER_POINTS_MS, 60_000),
};
