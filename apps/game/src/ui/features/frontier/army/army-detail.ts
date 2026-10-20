import type { IconMeaning } from "@/ui/design-system/icon";
import { ARMY_DETAIL, ATTRIBUTES, RESEARCH_TREE, TIER_WORDS } from "@/ui/design-system/kit/words";
import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";
import { formatExact, formatPercent } from "@bibliothecadao/types";

/**
 * An army as progression.cairo rules it, read from its facts: its XP, its four attributes, each with its level (common
 * 1 to legendary 5), what it gives now and what its next level gives and costs. One XP price table serves all four, so
 * the cheapest next level is the lowest attribute's; a level bought refills some stamina; a Scouting level names the
 * kind of site it finds more of.
 */

export type AttributeKey = "battle" | "logistics" | "scouting" | "homecoming";
export type ScoutKind = "camp" | "rift" | "beasts";

/** What the detail reads of an army and its game. */
export interface ArmyDetailFacts {
  name: string;
  art: IconMeaning;
  troops: number;
  xp: number;
  stamina: { current: number; max: number };
  progress: Record<AttributeKey, number> & { scoutingKinds: readonly ScoutKind[] };
  /** The XP each level above common costs: uncommon, rare, epic, legendary. */
  levelXp: readonly [number, number, number, number];
  revealXp: number;
  shrineXp: number;
  /** The stamina a level bought refills, before the army's maximum caps it. */
  refillOnLevel: number;
}

export interface AttributeView {
  key: AttributeKey;
  name: string;
  /** The Aspect's mark the attribute wears. */
  mark: IconMeaning;
  stat: string;
  level: number;
  now: string;
  next?: { word: string; change: string; xp: number; affordable: boolean };
}

export interface ArmyView {
  name: string;
  art: IconMeaning;
  troops: number;
  xp: number;
  stamina: { current: number; max: number };
  attributes: AttributeView[];
  /** The cheapest level the XP goes to next, and how much of it is held (0 to 1). */
  goal?: { xp: number; share: number };
  /** Levels the XP buys right now. */
  affordable: number;
  /** How XP is earned, with this game's figures. */
  earn: { icon: IconMeaning; line: string; xp?: number }[];
  /** Stamina a level bought refills now, the most that fits. */
  refill: number;
}

const ATTRIBUTE_ROWS: { key: AttributeKey; mark: IconMeaning }[] = [
  { key: "battle", mark: "order-rage" },
  { key: "logistics", mark: "order-skill" },
  { key: "scouting", mark: "order-detection" },
  { key: "homecoming", mark: "order-enlightenment" },
];

export const readArmyDetail = (army: ArmyDetailFacts): ArmyView => {
  const attributes = ATTRIBUTE_ROWS.map(({ key, mark }, index): AttributeView => {
    const level = army.progress[key];
    const price = army.levelXp[level - 1];
    const figure = (at: number) =>
      attributeFigure(key, at, army.stamina.max - logisticsStamina(army.progress.logistics));
    const now = key === "scouting" ? scoutingNow(army.progress.scoutingKinds) : figure(level);
    return {
      key,
      name: ATTRIBUTES[index],
      mark,
      stat: ARMY_DETAIL.stats[key],
      level,
      now,
      next:
        price === undefined
          ? undefined
          : {
              word: TIER_WORDS[level]!,
              // A Scouting level adds its step to the kind picked with it; every other attribute moves to its next figure.
              change:
                key === "scouting"
                  ? ARMY_DETAIL.scoutingNext(
                      now,
                      formatPercent(scoutingIncrementBps(level + 1) / 10_000, { signed: true }),
                    )
                  : RESEARCH_TREE.step(now, figure(level + 1)),
              xp: price,
              affordable: army.xp >= price,
            },
    };
  });
  const prices = attributes.flatMap(({ next }) => (next ? [next.xp] : []));
  const cheapest = prices.length ? Math.min(...prices) : undefined;
  return {
    name: army.name,
    art: army.art,
    troops: army.troops,
    xp: army.xp,
    stamina: army.stamina,
    attributes,
    goal: cheapest === undefined ? undefined : { xp: cheapest, share: Math.min(1, army.xp / cheapest) },
    affordable: attributes.filter(({ next }) => next?.affordable).length,
    earn: [
      { icon: "explore", line: ARMY_DETAIL.earn.explore, xp: army.revealXp },
      { icon: "shrine", line: ARMY_DETAIL.earn.shrine, xp: army.shrineXp },
      { icon: "camp", line: ARMY_DETAIL.earn.clear },
    ],
    refill: Math.max(0, Math.min(army.refillOnLevel, army.stamina.max - army.stamina.current)),
  };
};

/**
 * What an attribute gives at a level, as the army's own figure: the damage it adds, its maximum stamina (its troop's
 * base plus Logistics), what it finds more of, the share of its troops it brings home.
 */
const attributeFigure = (key: AttributeKey, level: number, baseStamina: number): string => {
  if (key === "battle") return formatPercent(battleBonusBps(level) / 10_000, { signed: true });
  if (key === "logistics") return formatExact(baseStamina + logisticsStamina(level));
  if (key === "homecoming") return formatPercent(homecomingBps(level) / 10_000);
  // Every Scouting level above common on one kind.
  const steps = Array.from({ length: level - 1 }, (_, index) => scoutingIncrementBps(index + 2));
  return formatPercent(steps.reduce((sum, step) => sum + step, 0) / 10_000, { signed: true });
};

/** Where the army's Scouting levels went: "+10% Rifts"; nothing yet reads as no bonus. */
const scoutingNow = (kinds: readonly ScoutKind[]): string => {
  if (kinds.length === 0) return formatPercent(0, { signed: true });
  const byKind = new Map<ScoutKind, number>();
  kinds.forEach((kind, index) => byKind.set(kind, (byKind.get(kind) ?? 0) + scoutingIncrementBps(index + 2)));
  return [...byKind]
    .map(([kind, bps]) => ARMY_DETAIL.onKind(formatPercent(bps / 10_000, { signed: true }), RESEARCH_TREE.kinds[kind]))
    .join(" · ");
};
