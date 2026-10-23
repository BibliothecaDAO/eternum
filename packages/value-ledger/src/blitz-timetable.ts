/**
 * The Blitz timetable, read by the launch service that schedules it, the client that shows it and the docs that state
 * it. Nothing here imports a chain library, so a page can read it.
 */

/** Registration freezes before the common game clock starts, leaving time to create and seat every group. */
export const BLITZ_SLOT_PREPARATION_SECONDS = 300;

/** A slot's games start on this grid of the UTC day: 00:00, 01:30, ... 22:30, while the season's Blitz window is open. */
export const BLITZ_SLOT_INTERVAL_SECONDS = 90 * 60;
