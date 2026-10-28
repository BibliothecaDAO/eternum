import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { StructureType } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { ARMY_DETAIL, ATTRIBUTE_NAMES, RESEARCH_TREE, type Tier } from "@/ui/design-system/kit/words";
import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatExact, formatPercent } from "@bibliothecadao/types";

/**
 * An army as progression.cairo rules it, read from its facts: its XP, its four attributes, each with its level (common
 * 1 to legendary 5), what it gives now and what its next level gives and costs. One XP price table serves all four, so
 * the cheapest next level is the lowest attribute's; a level bought refills some stamina; a Scouting level names the
 * kind of site it finds more of.
 */

/**
 * Every attribute an army levels, under its name in the game's schema (progression::Attribute, what BuyTier sends): its
 * field on the army's progress, the name a player reads and its Aspect's mark, read together. The one list the army's
 * panel, a phone's picked army, the level-up command and the Feed read; a test holds it to the generated schema.
 */
export const ARMY_ATTRIBUTES = {
  Battle: { key: "battle", name: ATTRIBUTE_NAMES.Battle, mark: "order-rage" },
  Logistics: { key: "logistics", name: ATTRIBUTE_NAMES.Logistics, mark: "order-skill" },
  Scouting: { key: "scouting", name: ATTRIBUTE_NAMES.Scouting, mark: "order-detection" },
  Homecoming: { key: "homecoming", name: ATTRIBUTE_NAMES.Homecoming, mark: "order-enlightenment" },
} as const satisfies Record<string, { key: keyof NativeRows["ArmyProgress"]; name: string; mark: IconMeaning }>;

export type Attribute = keyof typeof ARMY_ATTRIBUTES;
export type AttributeKey = (typeof ARMY_ATTRIBUTES)[Attribute]["key"];

/** The attributes in the schema's order, each with its name there. */
export const ATTRIBUTE_LIST = (Object.keys(ARMY_ATTRIBUTES) as Attribute[]).map((attribute) => ({
  attribute,
  ...ARMY_ATTRIBUTES[attribute],
}));

/** The attribute whose field on the army's progress is `key`, by its name in the schema (what BuyTier sends). */
export const attributeOf = (key: AttributeKey): Attribute => ATTRIBUTE_LIST.find((row) => row.key === key)!.attribute;

export type ScoutKind = "camp" | "rift" | "beasts";

/** What the detail reads of an army and its game. */
export interface ArmyDetailFacts {
  name: string;
  art: IconMeaning;
  troops: number;
  xp: number;
  stamina: StaminaBar;
  /** Seconds until the stamina is full; 0 or undefined once it is. */
  secondsToFull: number | undefined;
  /** What each tile explored sends home, in whole Essence and labor: unknown at a depth with no rule, null in a game whose reveals pay none. */
  revealYield: number | undefined | null;
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
  level: Tier;
  /** What it gives now, as its effect: "+10% damage", "170 max stamina", "3% come home". */
  now: string;
  /** The next level: its tier, the change in one line, its XP, whether it is held, and the stamina buying it refills. */
  next?: { tier: Exclude<Tier, 1>; change: string; xp: number; affordable: boolean; refill: number };
}

export interface ArmyView {
  name: string;
  art: IconMeaning;
  troops: number;
  xp: number;
  stamina: StaminaBar;
  secondsToFull: number | undefined;
  revealYield: number | undefined | null;
  attributes: AttributeView[];
  /** The cheapest level the XP goes to next, and how much of it is held (0 to 1). */
  goal?: { xp: number; share: number };
  /** Levels the XP buys right now. */
  affordable: number;
  /** How XP is earned, with this game's figures. */
  earn: { icon: IconMeaning; line: string; xp?: number }[];
  /** Stamina a level of an attribute other than Logistics refills now, the most that fits under today's maximum. */
  refill: number;
}

export const readArmyDetail = (army: ArmyDetailFacts): ArmyView => {
  const attributes = ATTRIBUTE_LIST.map(({ key, name, mark }): AttributeView => {
    const level = army.progress[key];
    const price = army.levelXp[level - 1];
    const figure = (at: number) =>
      attributeFigure(key, at, army.stamina.max - logisticsStamina(army.progress.logistics));
    const effect = RESEARCH_TREE.effects[key];
    const now = key === "scouting" ? scoutingNow(army.progress.scoutingKinds) : effect(figure(level));
    return {
      key,
      name,
      mark,
      level: level as Tier,
      now,
      next:
        price === undefined
          ? undefined
          : {
              tier: (level + 1) as Exclude<Tier, 1>,
              // A Scouting level adds its step to the kind picked with it; every other attribute moves to its next figure.
              change:
                key === "scouting"
                  ? ARMY_DETAIL.scoutingNext(
                      now,
                      formatPercent(scoutingIncrementBps(level + 1) / 10_000, { signed: true }),
                    )
                  : RESEARCH_TREE.step(figure(level), effect(figure(level + 1))),
              xp: price,
              affordable: army.xp >= price,
              refill: levelRefill(
                army,
                key === "logistics" ? logisticsStamina(level + 1) - logisticsStamina(level) : 0,
              ),
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
    secondsToFull: army.secondsToFull,
    revealYield: army.revealYield,
    attributes,
    goal: cheapest === undefined ? undefined : { xp: cheapest, share: Math.min(1, army.xp / cheapest) },
    affordable: attributes.filter(({ next }) => next?.affordable).length,
    earn: [
      { icon: "explore", line: ARMY_DETAIL.earn.explore, xp: army.revealXp },
      { icon: "shrine", line: ARMY_DETAIL.earn.shrine, xp: army.shrineXp },
      { icon: structureMeaning(StructureType.Camp, "frontier"), line: ARMY_DETAIL.earn.clear },
    ],
    refill: levelRefill(army, 0),
  };
};

/**
 * The stamina a level bought refills, as relics.cairo's buy_tier grants it: the level is written first, so the refill
 * fits under the maximum after it (a Logistics level raises the maximum by `raised`), up to the grant's own size.
 */
const levelRefill = (army: ArmyDetailFacts, raised: number): number =>
  Math.max(0, Math.min(army.refillOnLevel, army.stamina.max + raised - army.stamina.current));

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

/** Where the army's Scouting levels went: "+10% discovery on Rifts"; nothing yet reads as no bonus. */
const scoutingNow = (kinds: readonly ScoutKind[]): string => {
  if (kinds.length === 0) return RESEARCH_TREE.effects.scouting(formatPercent(0, { signed: true }));
  const byKind = new Map<ScoutKind, number>();
  kinds.forEach((kind, index) => byKind.set(kind, (byKind.get(kind) ?? 0) + scoutingIncrementBps(index + 2)));
  return [...byKind]
    .map(([kind, bps]) =>
      ARMY_DETAIL.onKind(
        RESEARCH_TREE.effects.scouting(formatPercent(bps / 10_000, { signed: true })),
        RESEARCH_TREE.kinds[kind],
      ),
    )
    .join(" · ");
};
