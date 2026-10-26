import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";

import history from "./recorded-day-history.json";

/**
 * Frontier game 1 on prod as its Herald held it when its leading player opened day 2's summary (06:26Z, 23 Oct 2026):
 * the game's calendar, and its history then, newest first: the game's newest 350 events and every event naming that
 * player (public data; each value's event_position, which repeats its place, left out). Day 2 ran from 09:46Z to 21:46Z on
 * 22 Oct; the player's own stories in it are 35 reveals and 5 sites cleared, paying 7,246 Essence and 524 Labor. The
 * player played on in day 3 before opening that summary: a building placed at 05:56Z (`playedOn`), the first of their
 * stories after day 2.
 */
export const RECORDED_DAY = {
  calendar: {
    seed: 2573676726636859778969854071392817267192924319393663153312707624839662595849n,
    startMainAt: 1792575960,
    dayUnitSeconds: 14400,
  },
  player: "0x510fa645565fc77a784918630a27d0e1c07255b698fb44966ebd0b801439001",
  openedAt: 1792736760,
  playedOn: { at: 1792734968, block: 164293 },
  history: history as HeraldHistoryEvent[],
};
