import { NOTIFICATION_LEVELS, type NotificationLevel } from "./preferences";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Every kind of alert the game pushes, the level that first carries it and how long an alert of it may live: while it
 * is still true. The server, the live page and Settings all read this table; nothing names a kind's level elsewhere.
 * - Day open lives until an hour before its day ends, an army rested and a Deep site to take until their day ends:
 *   each alert carries its own end, and the bound here is longer than any game day.
 * - A repeat of a kind in one game replaces the alert still shown (one tag per game and kind) instead of stacking.
 */
export const NOTIFICATION_KIND_RULES = {
  "day-open": { level: "important", lifetimeMs: 48 * HOUR },
  "army-rested": { level: "important", lifetimeMs: 48 * HOUR },
  "deep-sites": { level: "important", lifetimeMs: 48 * HOUR },
  fights: { level: "important", lifetimeMs: HOUR },
  results: { level: "important", lifetimeMs: 24 * HOUR },
  messages: { level: "important", lifetimeMs: HOUR },
  deliveries: { level: "all", lifetimeMs: HOUR },
  bitcoin: { level: "all", lifetimeMs: HOUR },
  points: { level: "all", lifetimeMs: HOUR },
} as const satisfies Record<string, { level: Exclude<NotificationLevel, "off">; lifetimeMs: number }>;

export type NotificationKind = keyof typeof NOTIFICATION_KIND_RULES;
export const NOTIFICATION_KINDS = Object.keys(NOTIFICATION_KIND_RULES) as NotificationKind[];

/** A notice that is not one of the game's kinds (Alerts are on) lives two minutes. */
export const NOTICE_LIFETIME_MS = 2 * MINUTE;

/** Whether a player at this level is pushed alerts of this kind. */
export const includesKind = (level: NotificationLevel, kind: NotificationKind): boolean =>
  NOTIFICATION_LEVELS.indexOf(level) >= NOTIFICATION_LEVELS.indexOf(NOTIFICATION_KIND_RULES[kind].level);

/** The kinds a level carries, in the table's order: what Settings says the level brings. */
export const kindsAtLevel = (level: NotificationLevel): NotificationKind[] =>
  NOTIFICATION_KINDS.filter((kind) => includesKind(level, kind));

/** How long an alert of this kind may live; a notice with no kind, two minutes. */
export const lifetimeOf = (kind: NotificationKind | undefined): number =>
  kind === undefined ? NOTICE_LIFETIME_MS : NOTIFICATION_KIND_RULES[kind].lifetimeMs;

/** The one alert a game keeps shown per kind: a newer one of the kind replaces it. */
export const kindTag = (kind: NotificationKind, target: string): string => `${kind}:${target}`;
