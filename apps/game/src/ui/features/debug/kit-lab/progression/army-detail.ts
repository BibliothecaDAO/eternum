import type { IconMeaning } from "@/ui/design-system/icon";
import { TIER_WORDS } from "@/ui/design-system/kit/words";

import {
  ATTRIBUTE_AT,
  type ArmyFacts,
  clearXp,
  scoutingStep,
  TIER_STAMINA_REFILL,
  XP_RULES,
} from "./progression-facts";

/**
 * An army as progression.cairo rules it, read from its facts: its XP, its four attributes, each with its level (common
 * 1 to legendary 5), what it gives now as a figure, and what the next level gives and costs. Every attribute shares one
 * XP price table, so the cheapest next level is the lowest attribute's; a level bought refills some stamina. Scouting
 * names the kind of site its new level finds more of. The three proposals draw this one reading.
 */

export type AttributeKey = "battle" | "logistics" | "scouting" | "homecoming";

export interface AttributeView {
  key: AttributeKey;
  name: string;
  /** The Aspect's mark for the attribute, as the army sheet draws it today. */
  mark: IconMeaning;
  /** What it does, in a few words. */
  stat: string;
  level: number;
  levelWord: string;
  now: string;
  /** Every level's figure, common to legendary, for a track. */
  ladder: string[];
  /** The next level: its word, its figure, the change in one line ("+0% → +10%"), its XP and whether it is held. */
  next?: { word: string; value: string; change: string; xp: number; affordable: boolean };
}

export interface ArmyView {
  name: string;
  troops: number;
  xp: number;
  stamina: { current: number; max: number };
  attributes: AttributeView[];
  /** The cheapest level the XP goes to next, and how much of it is held. */
  goal?: { xp: number; share: number };
  /** Levels the XP buys right now. */
  affordable: number;
  /** How XP is earned, with this game's figures. */
  earn: { icon: IconMeaning; line: string; xp: string }[];
  /** Stamina refilled by a level bought, the most that fits. */
  refill: number;
}

const ATTRIBUTES: {
  key: AttributeKey;
  name: string;
  mark: IconMeaning;
  stat: string;
  at: (level: number) => string;
}[] = [
  {
    key: "battle",
    name: "Battle",
    mark: "order-rage",
    stat: "Damage dealt",
    at: (level) => `+${ATTRIBUTE_AT.battle(level)}%`,
  },
  {
    key: "logistics",
    name: "Logistics",
    mark: "order-skill",
    stat: "Max stamina",
    at: (level) => String(ATTRIBUTE_AT.logistics(level)),
  },
  {
    key: "scouting",
    name: "Scouting",
    mark: "order-detection",
    stat: "Sites found",
    at: (level) => `+${ATTRIBUTE_AT.scouting(level)}%`,
  },
  {
    key: "homecoming",
    name: "Homecoming",
    mark: "order-enlightenment",
    stat: "Troops back at day's end",
    at: (level) => `${ATTRIBUTE_AT.homecoming(level)}%`,
  },
];

/** The XP that buys the level after `level`; none at legendary. */
const levelPrice = (level: number): number | undefined => XP_RULES.tierXp[level - 1];

export const readArmy = (army: ArmyFacts): ArmyView => {
  const max = ATTRIBUTE_AT.logistics(army.logistics);
  const attributes = ATTRIBUTES.map(({ key, name, mark, stat, at }): AttributeView => {
    const level = army[key];
    const price = levelPrice(level);
    return {
      key,
      name,
      mark,
      stat,
      level,
      levelWord: TIER_WORDS[level - 1]!,
      now: key === "scouting" ? scoutingNow(army) : at(level),
      ladder: [1, 2, 3, 4, 5].map(at),
      next:
        price === undefined
          ? undefined
          : {
              word: TIER_WORDS[level]!,
              value: key === "scouting" ? `+${scoutingStep(level + 1)}%` : at(level + 1),
              // Scouting adds its step to the kind picked with it; every other attribute moves to its next figure.
              change:
                key === "scouting"
                  ? `${scoutingNow(army)} · +${scoutingStep(level + 1)}% on the kind you pick`
                  : `${at(level)} → ${at(level + 1)}`,
              xp: price,
              affordable: army.xp >= price,
            },
    };
  });
  const cheapest = Math.min(...attributes.flatMap(({ next }) => (next ? [next.xp] : [])));
  return {
    name: army.name,
    troops: army.troops,
    xp: army.xp,
    stamina: { current: army.stamina, max },
    attributes,
    goal: Number.isFinite(cheapest) ? { xp: cheapest, share: Math.min(1, army.xp / cheapest) } : undefined,
    affordable: attributes.filter(({ next }) => next?.affordable).length,
    earn: [
      { icon: "explore", line: "Explore a tile", xp: `+${XP_RULES.revealXp}` },
      { icon: "camp", line: "Clear a camp (1,300 guard)", xp: `+${clearXp(1300)}` },
      { icon: "shrine", line: "Visit a Shrine", xp: `+${XP_RULES.fixedXp}` },
    ],
    refill: Math.min(TIER_STAMINA_REFILL, max - army.stamina),
  };
};

/** Scouting's figure names where its levels went: "+10% rifts". */
const scoutingNow = (army: ArmyFacts): string => {
  if (army.scoutingKinds.length === 0) return "+0%";
  const byKind = new Map<string, number>();
  army.scoutingKinds.forEach((kind, index) => byKind.set(kind, (byKind.get(kind) ?? 0) + scoutingStep(index + 2)));
  return [...byKind].map(([kind, value]) => `+${value}% ${kind === "beasts" ? "beasts" : `${kind}s`}`).join(" · ");
};
