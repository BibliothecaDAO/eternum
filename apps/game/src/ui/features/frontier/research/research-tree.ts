import { buildingOpensAtLevel, isOathResearch, logisticsStamina } from "@bibliothecadao/eternum";
import type { IconMeaning, IconMark } from "@/ui/design-system/icon";
import { RESEARCH_TREE, SHRINE, SPIRE, STAMINA, type RankedWords, type Tier, WELL } from "@/ui/design-system/kit/words";
import { nativeResearchConstants as research, nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { BuildingType, formatExact, formatFigure, formatPercent, rankName } from "@bibliothecadao/types";

import { buildingIcon, buildingName } from "../build/building-names";

/**
 * The castle's tree as research.cairo and construction.cairo rule it, read from a realm's facts: every node a player
 * can research, how it stands, each thing its next tier needs (met or not, in the order a player meets them), and
 * what it gives now and next.
 *
 *   - A building row opens once a building of its type stands, and climbs 0 to legendary (five buys);
 *   - the Shrine and the Well are one buy each, Essence only;
 *   - the Ethereal reaches are bought in order, I then II then III, Essence only.
 */

export type LearnedRow = { tier: number };

/** What the tree reads of a realm and its game, in whole units. */
export interface RealmResearchFacts {
  castleLevel: number;
  essence: number;
  labor: number;
  /** Buildings of each building row's type standing (the castle's own labor producer is not a Workshop). */
  standing: Partial<Record<number, number>>;
  learned: Partial<Record<number, LearnedRow>>;
  /** A row's tier's price, as the game's preset sets it. */
  price: (row: number, tier: number) => { essence: number; labor: number };
  board: {
    outputStepBps: number;
    rationStep: number;
    wheatPerTroop: number;
    troopsPerHour: number;
    staminaBar: number;
  };
  laborStore: (level: number) => number;
}

export type Branch = keyof typeof RESEARCH_TREE.branches;
type ResearchEra = 0 | 1 | 2;
export const RESEARCH_ERAS: readonly ResearchEra[] = [0, 1, 2];
export const researchEraForLevel = (level: number): ResearchEra =>
  RESEARCH_ERAS[Math.min(RESEARCH_ERAS.length - 1, Math.max(0, level))]!;
/** done: nothing left to buy; ready: buyable now; short: open, the Essence or labor not held yet; locked: waits on a step. */
export type NodeState = keyof typeof RESEARCH_TREE.states;

export type ResearchLinkState = "done" | "ready" | "locked";

export interface ResearchLink {
  key: string;
  from: string;
  to: string;
  state: ResearchLinkState;
}

/** One thing a node's next tier needs, and whether the realm has it. */
export type Need =
  | { kind: "level"; met: boolean; level: string }
  | { kind: "stands"; met: boolean; building: string; icon: IconMeaning }
  | { kind: "tier"; met: boolean; node: string; icon: IconMeaning }
  | { kind: "store"; met: boolean; limit: number; need: number; level: string }
  | { kind: "essence" | "labor"; met: boolean; have: number; need: number };

/**
 * One thing a building row's research gives: its mark and word, what it does, its figure now, and with the next tier
 * (none at the top). Every surface that shows the figure shows what it does beside it.
 */
export type Figure = {
  icon: IconMark;
  name: string;
  line: string;
  now: RankedWords | string;
  next?: RankedWords | string;
};

export interface TreeNode {
  key: string;
  row: number;
  branch: Branch;
  era: ResearchEra;
  icon: IconMeaning;
  name: string;
  /** Tiers learned, and the most it can have: 5 for a building row, 1 for a castle node. */
  tier: number;
  maxTier: number;
  state: NodeState;
  /** The next tier and its price; none once done. */
  nextTier?: Tier;
  price?: { essence: number; labor: number };
  needs: Need[];
  /** What the node does, one line, and its figure now and after the next tier. */
  gives: { line: string; now: RankedWords | string; next?: RankedWords | string; direction?: "higher" | "lower" };
  shortEffect: string;
  job?: string;
  figures: Figure[];
  /** The nodes this one leads to (the tree's lines). */
  leadsTo: string[];
}

const ROWS = {
  farm: research.ROW_FARM,
  workshop: research.ROW_WORKSHOP,
  lore: research.ROW_LORE,
} as const;

type ResearchRow = Extract<keyof typeof research, `ROW_${string}`>;

const totalPercent = (bps: number) => formatPercent(1 + bps / 10_000);
export const readResearchTree = (realm: RealmResearchFacts): TreeNode[] => {
  const learned = (row: number) => realm.learned[row] ?? { tier: 0 };
  const store = realm.laborStore(realm.castleLevel);
  const levelFor = (labor: number) => {
    const level = [0, 1, 2, 3].find((at) => realm.laborStore(at) >= labor);
    return rankName(level ?? 3);
  };

  const buildingNeeds = (
    row: number,
    category: BuildingType,
    name: string,
    icon: IconMeaning,
    tier: number,
    extra: Need[],
  ): Need[] => {
    const price = realm.price(row, tier);
    const standing = (realm.standing[row] ?? 0) > 0;
    const opensAt = buildingOpensAtLevel(category);
    const levelNeed: Need[] =
      opensAt > 0 && !standing ? [{ kind: "level", met: realm.castleLevel >= opensAt, level: rankName(opensAt) }] : [];
    return [
      ...extra,
      ...levelNeed,
      { kind: "stands", met: standing, building: name, icon },
      ...(price.labor > store
        ? [{ kind: "store", met: false, limit: store, need: price.labor, level: levelFor(price.labor) } as const]
        : []),
      { kind: "essence", met: realm.essence >= price.essence, have: realm.essence, need: price.essence },
      { kind: "labor", met: realm.labor >= price.labor, have: realm.labor, need: price.labor },
    ];
  };

  const buildingNode = (
    row: number,
    category: BuildingType,
    branch: Branch,
    gives: (tier: number) => TreeNode["gives"],
    shortEffect: (tier: number) => string,
    options: {
      extra?: Need[];
      figures?: (tier: number) => Figure[];
      leadsTo?: string[];
      job?: string;
    } = {},
  ): TreeNode => {
    const tier = learned(row).tier;
    const name = buildingName(category);
    const icon = buildingIcon(category);
    const constructionGrant =
      tier === 0 &&
      [research.ROW_SUPPLY_YARD, research.ROW_CONSCRIPTION, research.ROW_RATIONS].some((value) => value === row);
    const maximum = isOathResearch(row) ? research.OATH_SLOTS_STEPS : 5;
    const next = tier < maximum ? tier + 1 : undefined;
    const nextNeeds = (at: number) => {
      const needs = buildingNeeds(row, category, name, icon, at, options.extra ?? []);
      return constructionGrant
        ? needs.filter((need) => need.kind === "level" || need.kind === "stands" || need.kind === "tier")
        : needs;
    };
    const needs = next === undefined ? [] : nextNeeds(next);
    const era = researchEraForLevel(buildingOpensAtLevel(category));
    return {
      key: `row-${row}`,
      row,
      branch,
      era,
      icon,
      name,
      tier,
      maxTier: maximum,
      state: constructionGrant ? "locked" : stateOf(next === undefined, needs),
      nextTier: next === undefined ? undefined : (next as Tier),
      price: constructionGrant || next === undefined ? undefined : realm.price(row, next),
      needs,
      gives: gives(tier),
      shortEffect: shortEffect(tier),
      figures: options.figures?.(tier) ?? [],
      leadsTo: options.leadsTo ?? [],
      job: options.job,
    };
  };

  const outputStep = (tier: number) => ({
    now: totalPercent(tier * realm.board.outputStepBps),
    next: tier < 5 ? totalPercent((tier + 1) * realm.board.outputStepBps) : undefined,
  });
  const outputRow = (row: number, category: BuildingType, icon: IconMeaning, [name, line]: readonly [string, string]) =>
    buildingNode(
      row,
      category,
      "economy",
      (tier) => ({ line, ...outputStep(tier) }),
      (tier) => {
        const step = outputStep(tier);
        return step.next ? RESEARCH_TREE.step(step.now, step.next) : step.now;
      },
      {
        figures: (tier) => [{ icon, name, line, ...outputStep(tier) }],
      },
    );

  const rows = {
    ROW_FARM: [outputRow(ROWS.farm, BuildingType.ResourceWheat, "fields", RESEARCH_TREE.outputs.fields)],
    ROW_WORKSHOP: [outputRow(ROWS.workshop, BuildingType.ResourceLabor, "tools", RESEARCH_TREE.outputs.tools)],
    ROW_CONSCRIPTION: [
      buildingNode(
        research.ROW_CONSCRIPTION,
        BuildingType.ConscriptionCamp,
        "army",
        (tier) => ({ line: RESEARCH_TREE.conscriptionLine, ...conscriptionStep(tier, realm.board) }),
        (tier) =>
          RESEARCH_TREE.shortEffects.troops(
            troopsAnHourAt(tier, realm.board),
            tier < 5 ? troopsAnHourAt(tier + 1, realm.board) : undefined,
          ),
        {
          job: RESEARCH_TREE.conscriptionLine,
          figures: (tier) => [
            {
              icon: "troops",
              name: RESEARCH_TREE.troopsAnHour,
              line: RESEARCH_TREE.atEach(buildingName(BuildingType.ResourceKnightT1)),
              ...conscriptionFigure(tier, realm.board),
            },
          ],
        },
      ),
    ],
    ROW_RATIONS: [
      buildingNode(
        research.ROW_RATIONS,
        BuildingType.RationsDepot,
        "army",
        (tier) => ({ line: RESEARCH_TREE.rationsLine, ...rationsStep(tier, realm.board) }),
        (tier) =>
          RESEARCH_TREE.shortEffects.rations(
            wheatATroopAt(tier, realm.board),
            tier < 5 ? wheatATroopAt(tier + 1, realm.board) : undefined,
          ),
        {
          job: RESEARCH_TREE.rationsLine,
          figures: (tier) => [
            {
              icon: "wheat",
              name: RESEARCH_TREE.wheatATroop,
              line: RESEARCH_TREE.onEachDeploy,
              ...rationsFigure(tier, realm.board),
            },
          ],
        },
      ),
    ],
    ROW_KNIGHT_OATHS: oathNode(research.ROW_KNIGHT_OATHS, BuildingType.ResourceKnightT1),
    ROW_SCOUT_OATHS:
      realm.castleLevel >= research.SCOUTS_LODGE_LEVEL
        ? oathNode(research.ROW_SCOUT_OATHS, BuildingType.ScoutsLodge)
        : [],
    ROW_CROSSBOW_OATHS:
      realm.castleLevel >= research.RANGE_LEVEL
        ? oathNode(research.ROW_CROSSBOW_OATHS, BuildingType.ResourceCrossbowmanT1)
        : [],
    ROW_SUPPLY_YARD: [
      buildingNode(
        research.ROW_SUPPLY_YARD,
        BuildingType.SupplyYard,
        "army",
        (tier) => ({ line: RESEARCH_TREE.newArmiesStart("Logistics"), ...logisticsStep(tier, realm.board) }),
        (tier) =>
          RESEARCH_TREE.shortEffects.logistics(
            logisticsStaminaAt(tier, realm.board),
            tier < 5 ? logisticsStaminaAt(tier + 1, realm.board) : undefined,
          ),
        {
          figures: (tier) => [
            {
              icon: "stamina",
              name: "Logistics",
              line: RESEARCH_TREE.everyNewArmy,
              ...logisticsStep(tier, realm.board),
            },
          ],
        },
      ),
    ],
    ROW_LORE: loreLadder(),
  } satisfies Record<ResearchRow, TreeNode[]>;
  return Object.values(rows).flat();

  function loreLadder(): TreeNode[] {
    const ladder: {
      key: string;
      site: string;
      icon: IconMeaning;
      tier: number;
      line: string;
      now: string;
      next: string;
      shortEffect: (done: boolean) => string;
    }[] = [
      {
        key: "well",
        site: WELL,
        icon: "well",
        tier: research.LORE_WELLS,
        line: RESEARCH_TREE.wellLore,
        now: RESEARCH_TREE.none,
        next: RESEARCH_TREE.each(`${formatExact(nativeRuleConstants.WELL_REFILL_PERCENT)}% max ${STAMINA}`),
        shortEffect: () => RESEARCH_TREE.shortEffects.well(formatExact(nativeRuleConstants.WELL_REFILL_PERCENT)),
      },
      {
        key: "shrine",
        site: SHRINE,
        icon: "shrine",
        tier: research.LORE_SHRINES,
        line: RESEARCH_TREE.shrineLore,
        now: RESEARCH_TREE.closed,
        next: RESEARCH_TREE.opens,
        shortEffect: (done) => RESEARCH_TREE.shortEffects.open(done),
      },
      {
        key: "spire",
        site: SPIRE,
        icon: "spire",
        tier: research.LORE_SPIRES,
        line: RESEARCH_TREE.opensLayers,
        now: RESEARCH_TREE.closed,
        next: RESEARCH_TREE.opens,
        shortEffect: (done) => RESEARCH_TREE.shortEffects.open(done),
      },
    ];
    return ladder.map((step, index) => {
      const previous = ladder[index - 1];
      const before: Need[] = previous
        ? [
            {
              kind: "tier",
              met: learned(ROWS.lore).tier >= previous.tier,
              node: RESEARCH_TREE.lore(previous.site),
              icon: previous.icon,
            },
          ]
        : [];
      return castleNode(
        step.key,
        ROWS.lore,
        RESEARCH_TREE.lore(step.site),
        step.icon,
        { line: step.line, now: step.now, next: step.next },
        step.shortEffect,
        index as ResearchEra,
        step.tier,
        before,
        ladder[index + 1] ? [ladder[index + 1]!.key] : [],
      );
    });
  }

  function oathNode(row: number, category: BuildingType): TreeNode[] {
    const step = (tier: number) => ({
      now: RESEARCH_TREE.oathSlots(tier + research.OATH_SLOTS_BASE),
      next: tier < research.OATH_SLOTS_STEPS ? RESEARCH_TREE.oathSlots(tier + research.OATH_SLOTS_BASE + 1) : undefined,
    });
    return [
      buildingNode(
        row,
        category,
        "army",
        (tier) => ({ line: RESEARCH_TREE.newArmiesStart(RESEARCH_TREE.oaths), ...step(tier) }),
        (tier) =>
          RESEARCH_TREE.shortEffects.oaths(
            tier + research.OATH_SLOTS_BASE,
            tier < research.OATH_SLOTS_STEPS ? tier + research.OATH_SLOTS_BASE + 1 : undefined,
          ),
        {
          figures: (tier) => [
            { icon: "troops", name: RESEARCH_TREE.oaths, line: RESEARCH_TREE.everyNewArmy, ...step(tier) },
          ],
        },
      ),
    ];
  }

  function castleNode(
    key: string,
    row: number,
    name: string,
    icon: IconMeaning,
    gives: TreeNode["gives"],
    shortEffect: (done: boolean) => string,
    era: ResearchEra = 0,
    tier = 1,
    before: Need[] = [],
    leadsTo: string[] = [],
  ): TreeNode {
    const done = learned(row).tier >= tier;
    const price = realm.price(row, tier);
    const needs: Need[] = done
      ? []
      : [...before, { kind: "essence", met: realm.essence >= price.essence, have: realm.essence, need: price.essence }];
    return {
      key,
      row,
      branch: "castle",
      era,
      icon,
      name,
      tier: done ? 1 : 0,
      maxTier: 1,
      state: stateOf(done, needs),
      price: done ? undefined : price,
      needs,
      gives: done ? { line: gives.line, now: gives.next ?? gives.now } : gives,
      shortEffect: shortEffect(done),
      figures: [],
      leadsTo,
    };
  }
};

const troopsAnHourAt = (rank: number, board: RealmResearchFacts["board"]) =>
  formatExact((board.troopsPerHour * (10_000 + rank * board.outputStepBps)) / 10_000);
const wheatATroopAt = (rank: number, board: RealmResearchFacts["board"]) =>
  formatFigure(Math.max(0, board.wheatPerTroop - rank * board.rationStep));
const logisticsStaminaAt = (level: number, board: RealmResearchFacts["board"]) =>
  formatFigure(board.staminaBar + logisticsStamina(board.staminaBar, level));
const conscriptionFigure = (tier: number, board: RealmResearchFacts["board"]): Pick<Figure, "now" | "next"> => ({
  now: troopsAnHourAt(tier, board),
  next: tier < 5 ? troopsAnHourAt(tier + 1, board) : undefined,
});
const rationsFigure = (tier: number, board: RealmResearchFacts["board"]): Pick<Figure, "now" | "next"> => ({
  now: wheatATroopAt(tier, board),
  next: tier < 5 ? wheatATroopAt(tier + 1, board) : undefined,
});
const conscriptionStep = (tier: number, board: RealmResearchFacts["board"]): Pick<Figure, "now" | "next"> => {
  const at = (rank: number) => RESEARCH_TREE.effects.troops(troopsAnHourAt(rank, board));
  return { now: at(tier), next: tier < 5 ? at(tier + 1) : undefined };
};
const rationsStep = (
  tier: number,
  board: RealmResearchFacts["board"],
): Pick<TreeNode["gives"], "now" | "next" | "direction"> => {
  const at = (rank: number) => RESEARCH_TREE.effects.rations(wheatATroopAt(rank, board));
  return { now: at(tier), next: tier < 5 ? at(tier + 1) : undefined, direction: "lower" };
};
const logisticsStep = (tier: number, board: RealmResearchFacts["board"]): Pick<Figure, "now" | "next"> => {
  const effect = (level: number) => RESEARCH_TREE.effects.logistics(logisticsStaminaAt(level, board));
  return { now: effect(tier), next: tier < 5 ? effect(tier + 1) : undefined };
};

/** A node's state from its needs: a missing step locks it; held short of Essence or labor, it waits on them. */
const stateOf = (done: boolean, needs: Need[]): NodeState => {
  if (done) return "done";
  if (
    needs.some(
      (need) =>
        !need.met && (need.kind === "level" || need.kind === "stands" || need.kind === "tier" || need.kind === "store"),
    )
  )
    return "locked";
  return needs.every((need) => need.met) ? "ready" : "short";
};

/** The first thing a node waits on: the one line a locked or short node shows, and the step its fix takes. */
export const firstMissing = (node: TreeNode): Need | undefined => node.needs.find((need) => !need.met);

export const needLine = (need: Need): string => {
  switch (need.kind) {
    case "level":
      return RESEARCH_TREE.needsLevel(need.level);
    case "stands":
      return need.met ? RESEARCH_TREE.stands(need.building) : RESEARCH_TREE.needsBuilding(need.building);
    case "tier":
      return need.met ? need.node : RESEARCH_TREE.needsFirst(need.node);
    case "store":
      return RESEARCH_TREE.store(formatExact(need.limit), formatExact(need.need), need.level);
    case "essence":
    case "labor":
      return need.met
        ? RESEARCH_TREE.held(RESEARCH_TREE.nouns[need.kind], formatExact(Math.floor(need.have)), formatExact(need.need))
        : RESEARCH_TREE.needsResource(formatExact(need.need), RESEARCH_TREE.nouns[need.kind]);
  }
};

/** Whether the realm can research anything now: the nav's Research dot. */
export const canResearchNow = (nodes: readonly TreeNode[] | undefined): boolean =>
  nodes?.some(({ state }) => state === "ready") ?? false;

export const researchVerb = (row: number): string =>
  isOathResearch(row) ? `${RESEARCH_TREE.upgrade} ${RESEARCH_TREE.oaths}` : RESEARCH_TREE.upgrade;

export const researchActionName = (node: Pick<TreeNode, "row" | "name">): string =>
  isOathResearch(node.row)
    ? `${RESEARCH_TREE.upgrade} ${node.name} ${RESEARCH_TREE.oaths}`
    : `${RESEARCH_TREE.upgrade} ${node.name}`;

const formatPickEffectStep = (
  now: RankedWords | string,
  next?: RankedWords | string,
  direction: "higher" | "lower" = "higher",
): RankedWords | string => {
  if (!next) return now;
  const step = RESEARCH_TREE.step(now, next);
  if (direction !== "lower") return step;
  return typeof step === "string" ? `${step} ${RESEARCH_TREE.less}` : [...step, ` ${RESEARCH_TREE.less}`];
};

export const researchEffectLine = (node: Pick<TreeNode, "gives">): RankedWords | string =>
  formatPickEffectStep(node.gives.now, node.gives.next, node.gives.direction);

const linkStateOf = (from: TreeNode, to: TreeNode): ResearchLinkState => {
  if (to.state === "done") return "done";
  if (from.state === "done" && (to.state === "ready" || to.state === "short")) return "ready";
  return "locked";
};

export const readResearchLinks = (nodes: readonly TreeNode[]): ResearchLink[] => {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const links: ResearchLink[] = [];
  for (const from of nodes) {
    for (const targetKey of from.leadsTo) {
      const to = byKey.get(targetKey);
      if (!to) continue;
      links.push({
        key: `${from.key}->${to.key}`,
        from: from.key,
        to: to.key,
        state: linkStateOf(from, to),
      });
    }
  }
  return links;
};
