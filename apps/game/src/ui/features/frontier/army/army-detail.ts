import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { StructureType } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { ARMY_DETAIL, ATTRIBUTES, RESEARCH_TREE, type Tier, type Rank } from "@/ui/design-system/kit/words";
import {
  battleBonusBps,
  homecomingBps,
  logisticsStamina,
  scoutingIncrementBps,
  nextSkillPoint,
  skillPointRefill,
  SKILL_POINT_RANKS,
} from "@bibliothecadao/eternum";
import { formatExact, formatPercent } from "@bibliothecadao/types";

export type AttributeKey = "battle" | "logistics" | "scouting" | "homecoming";
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
  points: readonly number[];
  rules: NativeRows["ArmyProgressionRules"];
  revealXp: number;
  shrineXp: number;
}

export interface AttributeView {
  key: AttributeKey;
  name: string;
  /** The Aspect's mark the attribute wears. */
  mark: IconMeaning;
  level: Rank;
  /** What it gives now, as its effect: "+10% damage", "170 max stamina", "3% come home". */
  now: string;
  next?: { tier: Tier; change: string; point?: Tier; affordable: boolean; refill: number };
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
  goal: ReturnType<typeof nextSkillPoint>;
  points: readonly number[];
  available: number;
  staminaPoints: { rank: Tier; count: number; refill: number }[];
  /** How XP is earned, with this game's figures. */
  earn: { icon: IconMeaning; line: string; xp?: number }[];
}

const ATTRIBUTE_ROWS: { key: AttributeKey; mark: IconMeaning }[] = [
  { key: "battle", mark: "order-rage" },
  { key: "logistics", mark: "order-skill" },
  { key: "scouting", mark: "order-detection" },
  { key: "homecoming", mark: "order-enlightenment" },
];

/** An attribute's mark, as its tile on the army's panel and its line in the Feed draw it. */
export const attributeMark = (key: AttributeKey): IconMeaning => ATTRIBUTE_ROWS.find((row) => row.key === key)!.mark;

export const readArmyDetail = (army: ArmyDetailFacts): ArmyView => {
  const attributes = ATTRIBUTE_ROWS.map(({ key, mark }, index): AttributeView => {
    const level = army.progress[key];
    const point = SKILL_POINT_RANKS.find((rank) => rank >= level + 1 && army.points[rank - 1]! > 0);
    const figure = (at: number) =>
      attributeFigure(key, at, army.stamina.max - logisticsStamina(army.progress.logistics));
    const effect = RESEARCH_TREE.effects[key];
    const now = key === "scouting" ? scoutingNow(army.progress.scoutingKinds) : effect(figure(level));
    return {
      key,
      name: ATTRIBUTES[index],
      mark,
      level: level as Rank,
      now,
      next:
        level === 5
          ? undefined
          : {
              tier: (level + 1) as Tier,
              // A Scouting level adds its step to the kind picked with it; every other attribute moves to its next figure.
              change:
                key === "scouting"
                  ? ARMY_DETAIL.scoutingNext(
                      now,
                      formatPercent(scoutingIncrementBps(level + 1) / 10_000, { signed: true }),
                    )
                  : RESEARCH_TREE.step(figure(level), effect(figure(level + 1))),
              point,
              affordable: point !== undefined,
              refill: levelRefill(
                army,
                point,
                key === "logistics" ? logisticsStamina(level + 1) - logisticsStamina(level) : 0,
              ),
            },
    };
  });
  return {
    name: army.name,
    art: army.art,
    troops: army.troops,
    xp: army.xp,
    stamina: army.stamina,
    secondsToFull: army.secondsToFull,
    revealYield: army.revealYield,
    attributes,
    goal: nextSkillPoint(army.xp, army.rules),
    points: army.points,
    available: army.points.reduce((sum, count) => sum + count, 0),
    staminaPoints: SKILL_POINT_RANKS.filter((rank) => army.points[rank - 1]! > 0).map((rank) => ({
      rank,
      count: army.points[rank - 1]!,
      refill: Math.max(0, Math.min(skillPointRefill(rank, true), army.stamina.max - army.stamina.current)),
    })),
    earn: [
      { icon: "explore", line: ARMY_DETAIL.earn.explore, xp: army.revealXp },
      { icon: "shrine", line: ARMY_DETAIL.earn.shrine, xp: army.shrineXp },
      { icon: structureMeaning(StructureType.Camp, "frontier"), line: ARMY_DETAIL.earn.clear },
    ],
  };
};

/**
 * The stamina a level bought refills, as relics.cairo's spend_skill_point grants it: the level is written first, so the refill
 * fits under the maximum after it (a Logistics level raises the maximum by `raised`), up to the grant's own size.
 */
const levelRefill = (army: ArmyDetailFacts, point: Tier | undefined, raised: number): number =>
  point === undefined
    ? 0
    : Math.max(0, Math.min(skillPointRefill(point), army.stamina.max + raised - army.stamina.current));

/**
 * What an attribute gives at a level, as the army's own figure: the damage it adds, its maximum stamina (its troop's
 * base plus Logistics), what it finds more of, the share of its troops it brings home.
 */
const attributeFigure = (key: AttributeKey, level: number, baseStamina: number): string => {
  if (key === "battle") return formatPercent(battleBonusBps(level) / 10_000, { signed: true });
  if (key === "logistics") return formatExact(baseStamina + logisticsStamina(level));
  if (key === "homecoming") return formatPercent(homecomingBps(level) / 10_000);
  // Every Scouting level on one kind.
  const steps = Array.from({ length: level }, (_, index) => scoutingIncrementBps(index + 1));
  return formatPercent(steps.reduce((sum, step) => sum + step, 0) / 10_000, { signed: true });
};

/** Where the army's Scouting levels went: "+10% discovery on Rifts"; nothing yet reads as no bonus. */
const scoutingNow = (kinds: readonly ScoutKind[]): string => {
  if (kinds.length === 0) return RESEARCH_TREE.effects.scouting(formatPercent(0, { signed: true }));
  const byKind = new Map<ScoutKind, number>();
  kinds.forEach((kind, index) => byKind.set(kind, (byKind.get(kind) ?? 0) + scoutingIncrementBps(index + 1)));
  return [...byKind]
    .map(([kind, bps]) =>
      ARMY_DETAIL.onKind(
        RESEARCH_TREE.effects.scouting(formatPercent(bps / 10_000, { signed: true })),
        RESEARCH_TREE.kinds[kind],
      ),
    )
    .join(" · ");
};
