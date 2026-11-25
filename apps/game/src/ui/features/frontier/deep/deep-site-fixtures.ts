import { frontierSeasonOnePreset } from "../../../../../../../config/source/frontier/season-one";
import { formatDuration } from "@bibliothecadao/types";

import type { DeepSiteProps, DeepSlot } from "./deep-site-view";

const TICK_SECONDS = 120;
const LOSS_PER_TICK = frontierSeasonOnePreset.deep.lossPerTick;

/** A guard slot whose lifetime follows from its troops: they last until the drain takes them all. */
const slot = (slot: number, realm: string, troops: number, mine = false): DeepSlot => {
  const left = Math.ceil(troops / LOSS_PER_TICK);
  return {
    slot,
    armyId: 100 + slot,
    oaths: 0,
    category: "Knight",
    tier: "T1",
    realm,
    troops,
    lossPerTick: LOSS_PER_TICK,
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
const base = { onClose: noop, pickBase: { deepLossPerTick: LOSS_PER_TICK }, ring: 0, opening: null };
const rates = {
  tickSeconds: TICK_SECONDS,
  glory: 6,
  height: 0,
  essence: 0,
  labor: 0,
  bar: null,
  drain: LOSS_PER_TICK,
};

/** The card's states on fixtures of its props: what the lab draws and the test asserts. */
export const DEEP_SITE_CASES = {
  "Hyperstructure archive, open, its beast, army in reach": {
    ...base,
    site: "foundation",
    rates: { ...rates, height: 6 },
    guard: { kind: "beast", category: "Knight", troops: 15_000 },
    order: { kind: "act", verb: "attack", stamina: 30, onAct: noop },
  },
  "Ethereal mine held by the player's Aspect, slots to join": {
    ...base,
    site: "mine",
    rates: { ...rates, glory: 0, labor: 300 },
    guard: {
      kind: "held",
      aspectId: 2,
      ally: true,
      next: 103,
      slots: withShares([slot(3, "Aldor", 6_000), slot(2, "Brek", 4_000, true)]),
    },
    order: { kind: "act", verb: "join", onAct: noop },
  },
  "Bane altar, locked until more Realms enter": {
    ...base,
    site: "altar",
    ring: 1,
    rates: null,
    opening: { entered: 12, realms: 50, pays: ["glory", "bar"] },
    guard: { kind: "beast", category: "Crossbowman", troops: 15_000 },
    order: { kind: "closed" },
  },
  "Essence core held by a rival Aspect": {
    ...base,
    site: "core",
    rates: { ...rates, glory: 0, essence: 300 },
    guard: {
      kind: "held",
      aspectId: 3,
      ally: false,
      next: 103,
      slots: withShares([slot(3, "Havoc Guard", 6_200)]),
    },
    order: { kind: "act", verb: "attack", stamina: 30, onAct: noop },
  },
  "Hyperstructure archive, the beast's fight forecast": {
    ...base,
    site: "foundation",
    rates: { ...rates, height: 6 },
    guard: { kind: "beast", category: "Knight", troops: 15_000 },
    attackerName: "Army 1",
    fight: {
      army: 12_400,
      defender: 15_000,
      attackerTroops: { category: "Knight", tier: "T1" },
      defenderTroops: { category: "Knight", tier: "T1" },
      result: { troopsLost: 4_580, guardLeft: 0 },
    },
    order: { kind: "act", verb: "attack", stamina: 30, onAct: noop },
  },
  "Essence core, the rival guard's fight forecast": {
    ...base,
    site: "core",
    rates: { ...rates, glory: 0, essence: 300 },
    guard: {
      kind: "held",
      aspectId: 3,
      ally: false,
      next: 103,
      slots: withShares([slot(3, "Havoc Guard", 6_200)]),
    },
    attackerName: "Army 1",
    fight: {
      army: 12_400,
      defender: 6_200,
      attackerTroops: { category: "Crossbowman", tier: "T1" },
      defenderTroops: { category: "Knight", tier: "T1" },
      result: { troopsLost: 2_550, guardLeft: 0 },
    },
    order: { kind: "act", verb: "attack", stamina: 30, onAct: noop },
  },
  "Ethereal mine, its beast, army short of stamina": {
    ...base,
    site: "mine",
    rates: { ...rates, glory: 0, labor: 300 },
    guard: { kind: "beast", category: "Knight", troops: 10_000 },
    order: { kind: "short", verb: "attack", line: "Needs 30 stamina, holds 12" },
  },
  "Bane altar, open, no guard, army away": {
    ...base,
    site: "altar",
    rates: { ...rates, bar: { perTick: 6, charge: 300, threshold: 1_500 } },
    guard: { kind: "open" },
    order: {
      kind: "move",
      prices: [
        { of: "stamina", amount: 30 },
        { of: "wheat", amount: 20 },
      ],
      onMove: noop,
    },
  },
} as const satisfies Record<string, DeepSiteProps>;
