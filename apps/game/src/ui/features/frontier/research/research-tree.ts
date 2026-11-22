import { logisticsStamina, researchHasIndependentSides, isOathResearch } from "@bibliothecadao/eternum";
import type { IconMeaning, IconMark } from "@/ui/design-system/icon";
import { RESEARCH_TREE, SHRINE, SPIRE, STAMINA, type RankedWords, type Tier, WELL } from "@/ui/design-system/kit/words";
import { nativeResearchConstants as research, nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { BuildingType, formatExact, formatFigure, formatPercent, rankName } from "@bibliothecadao/types";

import { buildingIcon, buildingName } from "../build/building-names";
import { sideMarks } from "./sides-taken";

/**
 * The castle's tree as research.cairo and construction.cairo rule it, read from a realm's facts: every node a player
 * can research, how it stands, each thing its next tier needs (met or not, in the order a player meets them), and
 * what it gives now and next.
 *
 *   - A building row opens once a building of its type stands, and climbs 0 to legendary (five buys);
 *   - a tier's labor must fit the castle's labor store, which grows with the castle's level and Storeroom picks;
 *   - the Shrine and the Well are one buy each, Essence only;
 *   - the Ethereal reaches are bought in order, I then II then III, Essence only.
 */

/** A row's highest tier and bought sides. Only Scouts retains purchase order. */
export type LearnedRow = { tier: number; sides: number[] };

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
    storageStepBps: number;
    populationStepBps: number;
    rationStep: number;
    wheatPerTroop: number;
    troopsPerHour: number;
    staminaBar: number;
  };
  /** The castle's labor store at a level, with the realm's Storeroom picks. */
  laborStore: (level: number) => number;
}

export type Branch = keyof typeof RESEARCH_TREE.branches;
/** done: nothing left to buy; ready: buyable now; short: open, the Essence or labor not held yet; locked: waits on a step. */
export type NodeState = keyof typeof RESEARCH_TREE.states;

/** One thing a node's next tier needs, and whether the realm has it. */
export type Need =
  | { kind: "stands"; met: boolean; building: string; icon: IconMeaning }
  | { kind: "tier"; met: boolean; node: string; icon: IconMeaning }
  | { kind: "store"; met: boolean; limit: number; need: number; level: string }
  | { kind: "essence" | "labor"; met: boolean; have: number; need: number };

/** A side a tier can take: its mark, its word, what it does, and its figure now and with one more pick. */
type SideEffect = { choice: number; icon: IconMark; name: string; line: string; now: string; next: string };
export type Side = SideEffect & {
  tier: number;
  nextTier?: Tier;
  price?: { essence: number; labor: number };
  state: NodeState;
  needs: Need[];
};

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
  gives: { line: string; now: RankedWords | string; next?: RankedWords | string };
  job?: string;
  /** Side upgrades with their own price, availability and command choice code. */
  sides?: Side[];
  /** The marks of bought sides; only Scouts keeps purchase order. */
  taken: IconMark[];
  /**
   * What a building row's research gives, without its tier's word: each side, or its one figure (a Hut's population, a
   * training building's attribute), now and with the next tier; a building's own card reads it. None for a castle node.
   */
  figures: Figure[];
  /** The nodes this one leads to (the tree's lines). */
  leadsTo: string[];
}

const ROWS = {
  farm: research.ROW_FARM,
  workshop: research.ROW_WORKSHOP,
  hut: research.ROW_HUT,
  lore: research.ROW_LORE,
} as const;

type ResearchRow = Extract<keyof typeof research, `ROW_${string}`>;

const percent = (bps: number) => formatPercent(bps / 10_000, { signed: true });
/** The realm's tree: Economy (Farm, Workshop, Hut), Army (Barracks, then the four training rows), Castle. */
export const readResearchTree = (realm: RealmResearchFacts): TreeNode[] => {
  const learned = (row: number) => realm.learned[row] ?? { tier: 0, sides: [] };
  const picks = (row: number, side: number) => learned(row).sides.filter((taken) => taken === side).length;
  const store = realm.laborStore(realm.castleLevel);
  const levelFor = (labor: number) => {
    const level = [0, 1, 2, 3].find((at) => realm.laborStore(at) >= labor);
    return rankName(level ?? 3);
  };

  /** What every tier of a building row needs: the building, the labor store's room, the Essence and labor. */
  const buildingNeeds = (row: number, name: string, icon: IconMeaning, tier: number, extra: Need[]): Need[] => {
    const price = realm.price(row, tier);
    return [
      ...extra,
      { kind: "stands", met: (realm.standing[row] ?? 0) > 0, building: name, icon },
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
    options: {
      extra?: Need[];
      sides?: (tier: number, done: boolean) => SideEffect[];
      taken?: () => IconMark[];
      /** The row's figures where it has no sides; a row with sides shows its sides. */
      figures?: (tier: number) => Figure[];
      leadsTo?: string[];
      job?: string;
    } = {},
  ): TreeNode => {
    const tier = researchHasIndependentSides(row) ? Math.max(picks(row, 0), picks(row, 1)) : learned(row).tier;
    const name = buildingName(category);
    const icon = buildingIcon(category);
    const constructionGrant =
      tier === 0 &&
      [research.ROW_SUPPLY_YARD, research.ROW_CONSCRIPTION, research.ROW_RATIONS].some((value) => value === row);
    const maximum = isOathResearch(row) ? research.OATH_SLOTS_STEPS : 5;
    const next = tier < maximum ? tier + 1 : undefined;
    const nextNeeds = (at: number) => {
      const needs = buildingNeeds(row, name, icon, at, options.extra ?? []);
      return constructionGrant ? needs.filter((need) => need.kind === "stands" || need.kind === "tier") : needs;
    };
    const needs = next === undefined ? [] : nextNeeds(next);
    const sides = options.sides?.(tier, next === undefined).map((side): Side => {
      const sideTier = researchHasIndependentSides(row) ? picks(row, side.choice) : tier;
      const done = sideTier === 5;
      const sideNeeds = done ? [] : nextNeeds(sideTier + 1);
      return {
        ...side,
        tier: sideTier,
        nextTier: done ? undefined : ((sideTier + 1) as Tier),
        price: done || constructionGrant ? undefined : realm.price(row, sideTier + 1),
        needs: sideNeeds,
        state: constructionGrant ? "locked" : stateOf(done, sideNeeds),
      };
    });
    const available =
      sides && ["ready", "short", "locked", "done"].flatMap((state) => sides.filter((side) => side.state === state))[0];
    return {
      key: `row-${row}`,
      row,
      branch,
      icon,
      name,
      tier,
      maxTier: maximum,
      state: constructionGrant ? "locked" : (available?.state ?? stateOf(next === undefined, needs)),
      nextTier: available ? available.nextTier : next === undefined ? undefined : (next as Tier),
      price: constructionGrant
        ? undefined
        : available
          ? available.price
          : next === undefined
            ? undefined
            : realm.price(row, next),
      needs: available?.needs ?? needs,
      gives: gives(tier),
      sides,
      taken: options.taken?.() ?? [],
      // A row with sides shows each side, with what its picks hold: one figure for the row would hide which side
      // holds what, and leave the others no way to be picked (the Scouts' lodge's three kinds).
      figures: sides
        ? sides.map((side) => ({
            icon: side.icon,
            name: side.name,
            line: side.line,
            now: side.now,
            next: side.state === "done" ? undefined : side.next,
          }))
        : (options.figures?.(tier) ?? []),
      leadsTo: options.leadsTo ?? [],
      job: options.job,
    };
  };

  type SideRule = { words: readonly [string, string]; at: (picks: number) => string };
  /** Fields or Tools against Granary or Storeroom: what one more pick of each adds, under its mark. */
  const twoSides = (row: number, make: SideRule, other: SideRule) => {
    const [makeMark, otherMark] = sideMarks(row);
    const mark = (side: number) => (side === 0 ? makeMark : otherMark);
    return {
      sides: (): SideEffect[] =>
        [make, other].map((side, index) => ({
          choice: index,
          icon: mark(index),
          name: side.words[0],
          line: side.words[1],
          now: side.at(picks(row, index)),
          next: side.at(Math.min(5, picks(row, index) + 1)),
        })),
      taken: () => learned(row).sides.map(mark),
    };
  };
  const output = (count: number) => percent(count * realm.board.outputStepBps);
  const storage = (count: number) => percent(count * realm.board.storageStepBps);
  const { sides } = RESEARCH_TREE;

  /** A Hut row's population share now and with its next tier. */
  const hutPopulation = (tier: number) => ({
    now: percent(tier * realm.board.populationStepBps),
    next: tier < 5 ? percent((tier + 1) * realm.board.populationStepBps) : undefined,
  });

  /** What a row's picks give so far, read from its two sides: "Fields +50% · Granary +25%". */
  const picksGive = (row: number, make: SideRule, other: SideRule) => () => ({
    line: `${make.words[0]} ${make.at(picks(row, 0))}`,
    now: `${other.words[0]} ${other.at(picks(row, 1))}`,
  });
  const farmSides: [SideRule, SideRule] = [
    { words: sides.fields, at: output },
    { words: sides.granary, at: storage },
  ];
  const workshopSides: [SideRule, SideRule] = [
    { words: sides.tools, at: output },
    { words: sides.storeroom, at: storage },
  ];
  const rows = {
    ROW_FARM: [
      buildingNode(
        ROWS.farm,
        BuildingType.ResourceWheat,
        "economy",
        picksGive(ROWS.farm, ...farmSides),
        twoSides(ROWS.farm, ...farmSides),
      ),
    ],
    ROW_WORKSHOP: [
      buildingNode(
        ROWS.workshop,
        BuildingType.ResourceLabor,
        "economy",
        picksGive(ROWS.workshop, ...workshopSides),
        twoSides(ROWS.workshop, ...workshopSides),
      ),
    ],
    ROW_HUT: [
      buildingNode(
        ROWS.hut,
        BuildingType.WorkersHut,
        "economy",
        (tier) => ({ line: RESEARCH_TREE.hutLine, ...hutPopulation(tier) }),
        {
          figures: (tier) => [
            { icon: "person", name: RESEARCH_TREE.population, line: RESEARCH_TREE.hutLine, ...hutPopulation(tier) },
          ],
        },
      ),
    ],
    ROW_CONSCRIPTION: [
      buildingNode(
        research.ROW_CONSCRIPTION,
        BuildingType.ConscriptionCamp,
        "army",
        (tier) => ({ line: RESEARCH_TREE.conscriptionLine, ...conscriptionStep(tier, realm.board) }),
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
    const ladder: { key: string; site: string; icon: IconMeaning; tier: number; line: string; next: string }[] = [
      {
        key: "well",
        site: WELL,
        icon: "well",
        tier: research.LORE_WELLS,
        line: RESEARCH_TREE.armiesFind(WELL),
        next: RESEARCH_TREE.each(`${formatExact(nativeRuleConstants.WELL_REFILL_PERCENT)}% max ${STAMINA}`),
      },
      {
        key: "shrine",
        site: SHRINE,
        icon: "shrine",
        tier: research.LORE_SHRINES,
        line: RESEARCH_TREE.armiesFind(SHRINE),
        next: RESEARCH_TREE.opens,
      },
      {
        key: "spire",
        site: SPIRE,
        icon: "spire",
        tier: research.LORE_SPIRES,
        line: RESEARCH_TREE.opensLayers,
        next: RESEARCH_TREE.opens,
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
        { line: step.line, now: "—", next: step.next },
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
      icon,
      name,
      tier: done ? 1 : 0,
      maxTier: 1,
      state: stateOf(done, needs),
      price: done ? undefined : price,
      needs,
      gives: done ? { line: gives.line, now: gives.next ?? gives.now } : gives,
      taken: [],
      figures: [],
      leadsTo,
    };
  }
};

const troopsAnHourAt = (rank: number, board: RealmResearchFacts["board"]) =>
  formatExact((board.troopsPerHour * (10_000 + rank * board.outputStepBps)) / 10_000);
const wheatATroopAt = (rank: number, board: RealmResearchFacts["board"]) =>
  formatFigure(Math.max(0, board.wheatPerTroop - rank * board.rationStep));
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
const rationsStep = (tier: number, board: RealmResearchFacts["board"]): Pick<Figure, "now" | "next"> => {
  const at = (rank: number) => RESEARCH_TREE.effects.rations(wheatATroopAt(rank, board));
  return { now: at(tier), next: tier < 5 ? at(tier + 1) : undefined };
};
const logisticsStep = (tier: number, board: RealmResearchFacts["board"]): Pick<Figure, "now" | "next"> => {
  const effect = (level: number) =>
    RESEARCH_TREE.effects.logistics(formatFigure(logisticsStamina(board.staminaBar, level), { signed: true }));
  return { now: effect(tier), next: tier < 5 ? effect(tier + 1) : undefined };
};

/** A node's state from its needs: a missing step locks it; held short of Essence or labor, it waits on them. */
const stateOf = (done: boolean, needs: Need[]): NodeState => {
  if (done) return "done";
  if (needs.some((need) => !need.met && (need.kind === "stands" || need.kind === "tier" || need.kind === "store")))
    return "locked";
  return needs.every((need) => need.met) ? "ready" : "short";
};

/** The first thing a node waits on: the one line a locked or short node shows, and the step its fix takes. */
export const firstMissing = (node: TreeNode): Need | undefined => node.needs.find((need) => !need.met);

/** A need in a player's words: "Build a Workshop", "Barracks 1/2 purchases first", "Essence 300 / 1,000". */
export const needLine = (need: Need): string => {
  switch (need.kind) {
    case "stands":
      return need.met ? RESEARCH_TREE.stands(need.building) : RESEARCH_TREE.build(need.building);
    case "tier":
      return need.met ? need.node : RESEARCH_TREE.first(need.node);
    case "store":
      return RESEARCH_TREE.store(formatExact(need.limit), formatExact(need.need), need.level);
    case "essence":
    case "labor":
      return RESEARCH_TREE.held(
        RESEARCH_TREE.nouns[need.kind],
        formatExact(Math.floor(need.have)),
        formatExact(need.need),
      );
  }
};

/** Whether the realm can research anything now: the nav's Research dot. */
export const canResearchNow = (nodes: readonly TreeNode[] | undefined): boolean =>
  nodes?.some(({ state }) => state === "ready") ?? false;

/** Missing selections stay unavailable when a provisional unlock is withdrawn. */
export const researchSideChoice = (node: TreeNode, side: number): number | undefined =>
  node.sides ? node.sides[side]?.choice : 0;

/** A chosen side supplies its own level, price and availability to every research control. */
export const researchSideNode = (node: TreeNode, side: number): TreeNode => {
  const choice = node.sides?.[side];
  return choice
    ? {
        ...node,
        tier: choice.tier,
        nextTier: choice.nextTier,
        price: choice.price,
        needs: choice.needs,
        state: choice.state,
      }
    : node;
};
