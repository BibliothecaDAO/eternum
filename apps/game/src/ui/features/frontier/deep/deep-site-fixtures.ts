import { frontierSeasonOnePreset } from "../../../../../../../config/source/frontier/season-one";
import { formatDuration, type AspectId, type Troops } from "@bibliothecadao/types";

import type { DeepGarrisonSlot, DeepSide, DeepSiteProps } from "./deep-site-view";

const TICK_SECONDS = 120;
const LOSS_PER_TICK = frontierSeasonOnePreset.deep.lossPerTick;

const slot = (
  slot: number,
  owner: string,
  aspectId: AspectId,
  side: DeepSide,
  category: Troops["category"],
  count: number,
  share: number,
  cap = 9_000,
): DeepGarrisonSlot => ({
  slot,
  owner,
  aspectId,
  side,
  troops: { category, tier: "T1" },
  count,
  cap,
  share,
  timeLeft: formatDuration(Math.ceil(count / LOSS_PER_TICK) * TICK_SECONDS, { days: false }),
});

const noop = () => {};
const knights = { category: "Knight", tier: "T1" } as const;
const base = { onClose: noop, ring: 0, opening: null };
const rates = {
  tickSeconds: TICK_SECONDS,
  glory: 6,
  height: 0,
  essence: 0,
  labor: 0,
  bar: null,
  drain: LOSS_PER_TICK,
};
const altarRates = { ...rates, bar: { perTick: 4, charge: 48, threshold: 120 }, glory: 4 };

const ownAndAlly = [slot(0, "Kael", 2, "own", "Knight", 1_498, 65), slot(1, "Mira", 2, "ally", "Crossbowman", 800, 35)];
const rivals = [slot(1, "Vex", 1, "rival", "Paladin", 1_200, 60), slot(0, "Taro", 1, "rival", "Knight", 800, 40)];

/** The card's states on fixtures of its props: what the lab draws and the test asserts. */
export const DEEP_SITE_CASES = {
  "Hyperstructure archive, open, its beast, army in reach": {
    ...base,
    site: "foundation",
    rates: { ...rates, height: 6 },
    guard: { kind: "beast", category: "Knight", troops: 15_000 },
    order: { kind: "attack", verb: "attack", stamina: 30, onAct: noop },
  },
  "Hyperstructure archive held by the player and an ally, army beside": {
    ...base,
    site: "foundation",
    rates: { ...rates, height: 6 },
    guard: {
      kind: "taken",
      owner: "Kael",
      aspectId: 2,
      side: "own",
      slots: ownAndAlly,
      mayAdd: true,
      alliesMayGuard: true,
      gloryWon: 148,
    },
    order: {
      kind: "guard",
      troops: knights,
      armyTroops: 1_200,
      guard: { most: 1_200, onSend: noop },
      withdraw: { most: 1_498, onSend: noop },
    },
  },
  "Altar of banes held by a rival Aspect, attack ready": {
    ...base,
    site: "altar",
    rates: altarRates,
    guard: {
      kind: "taken",
      owner: "Vex",
      aspectId: 1,
      side: "rival",
      slots: rivals,
      mayAdd: true,
      alliesMayGuard: true,
      gloryWon: undefined,
    },
    order: { kind: "attack", verb: "attack", stamina: 30, onAct: noop },
  },
  "Hyperstructure archive held and undefended": {
    ...base,
    site: "foundation",
    rates: { ...rates, height: 6 },
    guard: {
      kind: "taken",
      owner: "Kael",
      aspectId: 2,
      side: "own",
      slots: [],
      mayAdd: true,
      alliesMayGuard: true,
      gloryWon: 148,
    },
    order: { kind: "guard", troops: knights, armyTroops: 1_200, guard: { most: 1_200, onSend: noop } },
  },
  "Ethereal mine held by an ally, where only its owner guards": {
    ...base,
    site: "mine",
    rates: { ...rates, glory: 0, labor: 300 },
    guard: {
      kind: "taken",
      owner: "Mira",
      aspectId: 2,
      side: "ally",
      slots: [slot(0, "Mira", 2, "ally", "Crossbowman", 4_000, 100)],
      mayAdd: false,
      alliesMayGuard: false,
      gloryWon: undefined,
    },
    order: "ownerOnly",
  },
  "Bane altar held by the player's Aspect, no army beside": {
    ...base,
    site: "altar",
    rates: altarRates,
    guard: {
      kind: "taken",
      owner: "Mira",
      aspectId: 2,
      side: "ally",
      slots: [slot(0, "Mira", 2, "ally", "Crossbowman", 4_000, 100)],
      mayAdd: true,
      alliesMayGuard: true,
      gloryWon: undefined,
    },
    order: "noAdjacent",
  },
  "Hyperstructure archive, every guard slot full": {
    ...base,
    site: "foundation",
    rates: { ...rates, height: 6 },
    guard: {
      kind: "taken",
      owner: "Kael",
      aspectId: 2,
      side: "ally",
      slots: [
        slot(3, "Arn", 2, "ally", "Knight", 2_000, 25),
        slot(2, "Bel", 2, "ally", "Crossbowman", 2_000, 25),
        slot(1, "Mira", 2, "ally", "Paladin", 2_000, 25),
        slot(0, "Kael", 2, "ally", "Knight", 2_000, 25),
      ],
      mayAdd: true,
      alliesMayGuard: true,
      gloryWon: undefined,
    },
    order: "slotsFull",
  },
  "Essence core held, seen by a spectator": {
    ...base,
    site: "core",
    rates: { ...rates, glory: 0, essence: 300 },
    guard: {
      kind: "taken",
      owner: "Vex",
      aspectId: 1,
      side: "held",
      slots: rivals,
      mayAdd: false,
      alliesMayGuard: false,
      gloryWon: undefined,
    },
    order: "pickArmy",
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
  "Hyperstructure archive, the beast's fight forecast": {
    ...base,
    site: "foundation",
    rates: { ...rates, height: 6 },
    guard: { kind: "beast", category: "Knight", troops: 15_000 },
    fight: {
      army: 12_400,
      defender: 15_000,
      attackerTroops: { category: "Knight", tier: "T1" },
      defenderTroops: { category: "Knight", tier: "T1" },
      result: { troopsLost: 4_580, guardLeft: 0 },
    },
    order: { kind: "attack", verb: "attack", stamina: 30, onAct: noop },
  },
  "Altar of banes, the rival guard's fight forecast": {
    ...base,
    site: "altar",
    rates: altarRates,
    guard: {
      kind: "taken",
      owner: "Vex",
      aspectId: 1,
      side: "rival",
      slots: rivals,
      mayAdd: true,
      alliesMayGuard: true,
      gloryWon: undefined,
    },
    fight: {
      army: 12_400,
      defender: 1_200,
      attackerTroops: { category: "Crossbowman", tier: "T1" },
      defenderTroops: { category: "Paladin", tier: "T1" },
      result: { troopsLost: 550, guardLeft: 0 },
    },
    order: { kind: "attack", verb: "attack", stamina: 30, onAct: noop },
  },
  "Ethereal mine, its beast, army short of stamina": {
    ...base,
    site: "mine",
    rates: { ...rates, glory: 0, labor: 300 },
    guard: { kind: "beast", category: "Knight", troops: 10_000 },
    order: { kind: "short", line: "Needs 30 stamina, holds 12" },
  },
  "Bane altar, its beast, army away": {
    ...base,
    site: "altar",
    rates: altarRates,
    guard: { kind: "beast", category: "Crossbowman", troops: 15_000 },
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
