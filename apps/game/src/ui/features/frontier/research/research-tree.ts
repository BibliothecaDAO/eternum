import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { StructureType } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import {
  depthName,
  RESEARCH_TREE,
  SHRINE,
  STAMINA,
  type Tier,
  tierNumeral,
  WELL,
  XP,
} from "@/ui/design-system/kit/words";
import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { BuildingType, formatExact, formatFigure, formatPercent, rankName } from "@bibliothecadao/types";

import { buildingIcon, buildingName } from "../build/building-names";

/**
 * The castle's tree as research.cairo and construction.cairo rule it, read from a realm's facts: every node a player
 * can research, how it stands, each thing its next tier needs (met or not, in the order a player meets them), and
 * what it gives now and next.
 *
 *   - A building row opens once a building of its type stands, and climbs common to legendary (four buys);
 *   - the four training buildings can only stand once the Barracks row reaches the board's gate tier (rare);
 *   - a tier's labor must fit the castle's labor store, which grows with the castle's level and Storeroom picks;
 *   - the Shrine and the Well are one buy each, Essence only;
 *   - the Ethereal reaches are bought in order, I then II then III, Essence only.
 */

/** A row as the realm has learned it: its tier, and the side taken at each tier (0 make, 1 store; the lodge's kind). */
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
    trainingGateTier: number;
  };
  /** The wheat one deployed troop costs with this many Rations picks on the Barracks row. */
  wheatPerTroop: (rations: number) => number;
  /** The castle's labor store at a level, with the realm's Storeroom picks. */
  laborStore: (level: number) => number;
  shrineXp: number;
  wellStamina: number;
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

/**
 * A side a tier can take: its mark, its word, what it does, and its figure now and with one more pick.
 */
export type Side = { icon: IconMeaning; name: string; line: string; now: string; next: string };

export interface TreeNode {
  key: string;
  row: number;
  branch: Branch;
  icon: IconMeaning;
  name: string;
  /** Tiers learned, and the most it can have: 4 for a building row, 1 for a castle node. */
  tier: number;
  maxTier: number;
  state: NodeState;
  /** The next tier and its price; none once done. */
  nextTier?: Exclude<Tier, 1>;
  price?: { essence: number; labor: number };
  needs: Need[];
  /** What the node does, one line, and its figure now and after the next tier. */
  gives: { line: string; now: string; next?: string };
  /** The sides its next tier chooses between; the choice sent is the side's index. */
  sides?: Side[];
  /** The marks of the sides taken, one per learned tier. */
  taken: IconMeaning[];
  /** The nodes this one leads to (the tree's lines). */
  leadsTo: string[];
  /** The Barracks' gate to the training buildings: the tier that opens them ("Barracks III"), and whether it is reached. */
  gate?: { name: string; met: boolean };
}

const ROWS = {
  farm: research.ROW_FARM,
  workshop: research.ROW_WORKSHOP,
  barracks: research.ROW_BARRACKS,
  hut: research.ROW_HUT,
  shrine: research.ROW_SHRINE,
  well: research.ROW_WELL,
  depth: research.ROW_DEPTH,
} as const;

type Attribute = "battle" | "logistics" | "scouting" | "homecoming";
const TRAINING: { row: number; category: BuildingType; attribute: Attribute; word: string }[] = [
  { row: research.ROW_WAR_HALL, category: BuildingType.WarHall, attribute: "battle", word: "Battle" },
  { row: research.ROW_SUPPLY_YARD, category: BuildingType.SupplyYard, attribute: "logistics", word: "Logistics" },
  { row: research.ROW_SCOUTS_LODGE, category: BuildingType.ScoutsLodge, attribute: "scouting", word: "Scouting" },
  { row: research.ROW_HEARTH, category: BuildingType.Hearth, attribute: "homecoming", word: "Homecoming" },
];
const KINDS: { icon: IconMeaning; name: string }[] = [
  { icon: structureMeaning(StructureType.Camp, "frontier"), name: RESEARCH_TREE.kinds.camp },
  { icon: structureMeaning(StructureType.Rift, "frontier"), name: RESEARCH_TREE.kinds.rift },
  { icon: structureMeaning(StructureType.Beasts, "frontier"), name: RESEARCH_TREE.kinds.beasts },
];
const DEPTH_MARKS: IconMeaning[] = ["depth-1", "depth-2", "depth-3"];

const percent = (bps: number) => formatPercent(bps / 10_000, { signed: true });
/** What one level of Scouting adds to the kind picked with it, in basis points of that kind's base rate. */
const scoutingStep = (level: number) => scoutingIncrementBps(level);

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
      sides?: (tier: number) => Side[];
      taken?: () => IconMeaning[];
      leadsTo?: string[];
      gate?: TreeNode["gate"];
    } = {},
  ): TreeNode => {
    const { tier } = learned(row);
    const name = buildingName(category);
    const icon = buildingIcon(category);
    const next = tier < 4 ? tier + 1 : undefined;
    const needs = next === undefined ? [] : buildingNeeds(row, name, icon, next, options.extra ?? []);
    return {
      key: `row-${row}`,
      row,
      branch,
      icon,
      name,
      tier,
      maxTier: 4,
      state: stateOf(next === undefined, needs),
      nextTier: next === undefined ? undefined : ((next + 1) as Exclude<Tier, 1>),
      price: next === undefined ? undefined : realm.price(row, next),
      needs,
      gives: gives(tier),
      sides: next === undefined ? undefined : options.sides?.(tier),
      taken: options.taken?.() ?? [],
      leadsTo: options.leadsTo ?? [],
      gate: options.gate,
    };
  };

  type SideRule = { icon: IconMeaning; words: readonly [string, string]; at: (picks: number) => string };
  /** Fields, Tools or Drill against Granary, Storeroom or Rations: what one more pick of each adds. */
  const twoSides = (row: number, make: SideRule, other: SideRule) => ({
    sides: (): Side[] =>
      [make, other].map((side, index) => ({
        icon: side.icon,
        name: side.words[0],
        line: side.words[1],
        now: side.at(picks(row, index)),
        next: side.at(picks(row, index) + 1),
      })),
    taken: () => learned(row).sides.map((side) => (side === 0 ? make.icon : other.icon)),
  });
  const output = (count: number) => percent(count * realm.board.outputStepBps);
  const storage = (count: number) => percent(count * realm.board.storageStepBps);
  const rations = (count: number) => formatFigure(realm.wheatPerTroop(count));
  const { sides } = RESEARCH_TREE;

  /** What a row's picks give so far, read from its two sides: "Fields +50% · Granary +25%". */
  const picksGive = (row: number, make: SideRule, other: SideRule) => () => ({
    line: `${make.words[0]} ${make.at(picks(row, 0))}`,
    now: `${other.words[0]} ${other.at(picks(row, 1))}`,
  });
  const farmSides: [SideRule, SideRule] = [
    { icon: "fields", words: sides.fields, at: output },
    { icon: "granary", words: sides.granary, at: storage },
  ];
  const workshopSides: [SideRule, SideRule] = [
    { icon: "tools", words: sides.tools, at: output },
    { icon: "storehouse", words: sides.storeroom, at: storage },
  ];
  const gateBarracks = `${buildingName(BuildingType.ResourceKnightT1)} ${tierShown(realm.board.trainingGateTier)}`;
  const gateNeed: Need = {
    kind: "tier",
    met: learned(ROWS.barracks).tier >= realm.board.trainingGateTier,
    node: gateBarracks,
    icon: buildingIcon(BuildingType.ResourceKnightT1),
  };

  return [
    buildingNode(
      ROWS.farm,
      BuildingType.ResourceWheat,
      "economy",
      picksGive(ROWS.farm, ...farmSides),
      twoSides(ROWS.farm, ...farmSides),
    ),
    buildingNode(
      ROWS.workshop,
      BuildingType.ResourceLabor,
      "economy",
      picksGive(ROWS.workshop, ...workshopSides),
      twoSides(ROWS.workshop, ...workshopSides),
    ),
    buildingNode(ROWS.hut, BuildingType.WorkersHut, "economy", (tier) => ({
      line: RESEARCH_TREE.hutLine,
      now: percent(tier * realm.board.populationStepBps),
      next: tier < 4 ? percent((tier + 1) * realm.board.populationStepBps) : undefined,
    })),
    buildingNode(
      ROWS.barracks,
      BuildingType.ResourceKnightT1,
      "army",
      (tier) => ({
        line: tier < realm.board.trainingGateTier ? RESEARCH_TREE.gateLine(gateBarracks) : RESEARCH_TREE.gateOpen,
        now: tierShown(tier),
        next: tier < 4 ? tierShown(tier + 1) : undefined,
      }),
      {
        ...twoSides(
          ROWS.barracks,
          { icon: "drill", words: sides.drill, at: output },
          { icon: "rations", words: sides.rations, at: rations },
        ),
        leadsTo: TRAINING.map(({ row }) => `row-${row}`),
        gate: { name: gateBarracks, met: gateNeed.met },
      },
    ),
    ...TRAINING.map(({ row, category, attribute, word }) =>
      buildingNode(row, category, "army", (tier) => trainingGives(attribute, word, tier), {
        extra: [gateNeed],
        ...(row === research.ROW_SCOUTS_LODGE
          ? {
              sides: (tier: number) =>
                KINDS.map((kind, index) => {
                  // A lodge tier starts new armies' Scouting one level higher, on the kind it picked.
                  const now = learned(row)
                    .sides.map((side, at) => (side === index ? scoutingStep(at + 2) : 0))
                    .reduce((sum, step) => sum + step, 0);
                  return {
                    icon: kind.icon,
                    name: kind.name,
                    line: RESEARCH_TREE.foundByNewArmies(kind.name),
                    now: percent(now),
                    next: percent(now + scoutingStep(tier + 2)),
                  };
                }),
              taken: () => learned(row).sides.map((side) => KINDS[side]!.icon),
            }
          : {}),
      }),
    ),
    castleNode("shrine", ROWS.shrine, SHRINE, "shrine", {
      line: RESEARCH_TREE.armiesFind(SHRINE),
      now: "—",
      next: RESEARCH_TREE.each(`+${formatExact(realm.shrineXp)} ${XP}`),
    }),
    castleNode("well", ROWS.well, WELL, "well", {
      line: RESEARCH_TREE.armiesFind(WELL),
      now: "—",
      next: RESEARCH_TREE.each(`+${formatExact(realm.wellStamina)} ${STAMINA}`),
    }),
    ...([1, 2, 3] as const).map((depth) => {
      const name = depthName(depth);
      const before: Need[] =
        depth === 1
          ? []
          : [
              {
                kind: "tier",
                met: learned(ROWS.depth).tier >= depth - 1,
                node: depthName((depth - 1) as 1 | 2),
                icon: DEPTH_MARKS[depth - 2]!,
              },
            ];
      return castleNode(
        `reach-${depth}`,
        ROWS.depth,
        name,
        DEPTH_MARKS[depth - 1]!,
        { line: RESEARCH_TREE.enters(name), now: "—", next: RESEARCH_TREE.opens },
        depth,
        before,
        depth < 3 ? [`reach-${depth + 1}`] : [],
      );
    }),
  ];

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
      leadsTo,
    };
  }
};

/** A research tier (0 common to 4 legendary) as text beside the gems: its numeral, Common I to Legendary V. */
const tierShown = (tier: number): string => tierNumeral((tier + 1) as Tier);

/** A training row: the level every new army of the realm starts the attribute at, and what that level gives. */
const trainingGives = (attribute: Attribute, word: string, tier: number): TreeNode["gives"] => {
  const at = (level: number) => RESEARCH_TREE.at(tierShown(level - 1), attributeEffect(attribute, level));
  return { line: RESEARCH_TREE.newArmiesStart(word), now: at(tier + 1), next: tier < 4 ? at(tier + 2) : undefined };
};

/** What an attribute gives at a level (1 common to 5 legendary), as the contract's tables apply it. */
const attributeEffect = (attribute: Attribute, level: number): string => {
  const { effects } = RESEARCH_TREE;
  if (attribute === "battle") return effects.battle(percent(battleBonusBps(level)));
  if (attribute === "logistics") return effects.logistics(formatFigure(logisticsStamina(level), { signed: true }));
  if (attribute === "scouting") {
    const total = Array.from({ length: level - 1 }, (_, index) => scoutingStep(index + 2)).reduce((a, b) => a + b, 0);
    return effects.scouting(percent(total));
  }
  return effects.homecoming(formatPercent(homecomingBps(level) / 10_000));
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

/** A need in a player's words: "Build a Workshop", "Barracks Rare first", "Essence 300 / 1,000". */
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
