import { formatDuration } from "@bibliothecadao/types";

import type { DeepSiteProps, DeepSlot } from "./deep-site-view";

/** Season 1's Deep: an army tick is 120 seconds and takes 200 troops from each army there. */
const TICK_SECONDS = 120;
const LOSS_PER_TICK = 200;

/** A guard slot whose lifetime follows from its troops: they last until the drain takes them all. */
const slot = (slot: number, realm: string, troops: number, mine = false): DeepSlot => {
  const left = Math.ceil(troops / LOSS_PER_TICK);
  return {
    slot,
    armyId: 100 + slot,
    realm,
    troops,
    ticks: { left, time: formatDuration(left * TICK_SECONDS, { days: false }) },
    share: 0,
    mine,
  };
};

/** Shares are troops over the guard's, out of 100, rounded to whole percents. */
const withShares = (slots: DeepSlot[]): DeepSlot[] => {
  const total = slots.reduce((sum, each) => sum + each.troops, 0);
  return slots.map((each) => ({ ...each, share: Math.round((each.troops * 100) / total) }));
};

const noop = () => {};
const base = { onClose: noop };
const pay = { glory: 5, height: 0, resources: 0, bar: null };

/** The card's states on fixtures of its props: what the lab draws and the test asserts. */
export const DEEP_SITE_CASES = {
  "Foundation, today's beast, army in reach": {
    ...base,
    site: "foundation",
    pay: { ...pay, height: 5 },
    guard: { kind: "beast", troops: 10_000 },
    order: { kind: "act", verb: "attack", onAct: noop },
  },
  "Quarry, army short of stamina": {
    ...base,
    site: "quarry",
    pay: { glory: 0, height: 0, resources: 500, bar: null },
    guard: { kind: "beast", troops: 10_000 },
    order: { kind: "short", verb: "attack", line: "Needs 30 stamina, holds 12" },
  },
  "Altar, open, army away": {
    ...base,
    site: "altar",
    pay: { ...pay, bar: { perTick: 5, charge: 300, threshold: 1_500 } },
    guard: { kind: "open" },
    order: { kind: "move", cost: "30 stamina · 20 wheat", onMove: noop },
  },
  "Foundation held, two slots filled": {
    ...base,
    site: "foundation",
    pay: { ...pay, height: 5 },
    guard: {
      kind: "held",
      aspect: "Might",
      next: 103,
      slots: withShares([slot(3, "Aldor", 6_000), slot(1, "Brek", 2_000, true)]),
    },
    order: "rival",
  },
  "Quarry held by the player's Aspect, a free slot to join": {
    ...base,
    site: "quarry",
    pay: { glory: 0, height: 0, resources: 500, bar: null },
    guard: {
      kind: "held",
      aspect: "Might",
      next: 102,
      slots: withShares([slot(2, "Brek", 4_000, true)]),
    },
    order: { kind: "act", verb: "join", onAct: noop },
  },
} as const satisfies Record<string, DeepSiteProps>;
