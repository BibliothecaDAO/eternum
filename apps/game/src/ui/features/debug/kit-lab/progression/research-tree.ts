import type { IconMeaning } from "@/ui/design-system/icon";
import { TIER_WORDS } from "@/ui/design-system/kit/words";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

import {
  ATTRIBUTE_AT,
  BOARD,
  CASTLE_LEVELS,
  laborStore,
  type RealmFacts,
  researchPrice,
  scoutingStep,
  WELL_STAMINA,
  XP_RULES,
} from "./progression-facts";

/**
 * The castle's tree as research.cairo and construction.cairo rule it, read from a realm's facts: every node a player
 * can research, its state, each thing its next tier needs (met or not, in the order a player meets them), and what it
 * gives now and next. The three proposals draw this one reading.
 *
 *   - A building row opens once a building of its type stands, and climbs common to legendary (four buys);
 *   - the four training buildings can only be built once the Barracks row is rare, so their rows wait on it;
 *   - a tier's labor must fit the castle's labor store, which grows with the castle's level and Storeroom picks;
 *   - the Shrine and the Well are one buy each, Essence only;
 *   - the Ethereal reaches are bought in order, I then II then III, Essence only.
 */

export type Branch = "economy" | "army" | "castle";
/** done: nothing left to buy; ready: buyable now; short: open, the Essence or labor not held yet; locked: waits on a step. */
export type NodeState = "done" | "ready" | "short" | "locked";

/** One thing a node's next tier needs, and whether the realm has it. */
export type Need =
  | { kind: "stands"; met: boolean; building: string; icon: IconMeaning }
  | { kind: "tier"; met: boolean; node: string; tier: string; icon: IconMeaning }
  | { kind: "store"; met: boolean; limit: number; need: number; level: string }
  | { kind: "essence" | "labor"; met: boolean; have: number; need: number };

/** A side a tier can take: its mark, its word, and what it gives now and with one more pick. */
export type Side = { icon: IconMeaning; name: string; line: string; now: string; next: string; picks: number };

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
  /** The next tier's word ("Uncommon") and price; none once done. */
  nextWord?: string;
  price?: { essence: number; labor: number };
  needs: Need[];
  /** What the node does, one line, and its figure now and after the next tier. */
  gives: { line: string; now: string; next?: string };
  /** The sides its next tier chooses between, final for the season. */
  sides?: Side[];
  /** The marks of the sides taken, one per learned tier. */
  taken: IconMeaning[];
  /** The nodes this one leads to (the tree's lines). */
  leadsTo: string[];
}

const ROWS = {
  farm: research.ROW_FARM,
  workshop: research.ROW_WORKSHOP,
  barracks: research.ROW_BARRACKS,
  hut: research.ROW_HUT,
  warHall: research.ROW_WAR_HALL,
  supplyYard: research.ROW_SUPPLY_YARD,
  lodge: research.ROW_SCOUTS_LODGE,
  hearth: research.ROW_HEARTH,
  shrine: research.ROW_SHRINE,
  well: research.ROW_WELL,
  depth: research.ROW_DEPTH,
} as const;

const TRAINING = [
  { key: "war-hall", row: ROWS.warHall, name: "War hall", icon: "war-hall", attribute: "battle" },
  { key: "supply-yard", row: ROWS.supplyYard, name: "Supply yard", icon: "supply-yard", attribute: "logistics" },
  { key: "scouts-lodge", row: ROWS.lodge, name: "Scouts' lodge", icon: "scout-lodge", attribute: "scouting" },
  { key: "hearth", row: ROWS.hearth, name: "Hearth", icon: "hearth", attribute: "homecoming" },
] as const;

const KINDS = [
  { icon: "camp", name: "Camps" },
  { icon: "rift", name: "Rifts" },
  { icon: "beasts", name: "Beasts" },
] as const satisfies readonly { icon: IconMeaning; name: string }[];

const percent = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
const amount = (value: number) => value.toLocaleString("en-US");

/** The realm's tree: Economy (Farm, Workshop, Hut), Army (Barracks, then the four training rows), Castle. */
export const readResearchTree = (realm: RealmFacts): TreeNode[] => {
  const learned = (row: number) => realm.learned[row] ?? { tier: 0, sides: [] };
  const picks = (row: number, side: number) => learned(row).sides.filter((taken) => taken === side).length;
  const store = laborStore(realm.castleLevel, picks(ROWS.workshop, 1));
  const barracksRare = learned(ROWS.barracks).tier >= BOARD.trainingGateTier;

  /** What every tier of a building row needs: the building, the labor store's room, the Essence and labor. */
  const buildingNeeds = (row: number, name: string, icon: IconMeaning, tier: number, extra: Need[] = []): Need[] => {
    const price = researchPrice(row, tier);
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
  const levelFor = (labor: number) =>
    CASTLE_LEVELS.find((_, level) => laborStore(level, picks(ROWS.workshop, 1)) >= labor) ?? CASTLE_LEVELS[3];

  const buildingNode = (
    key: string,
    row: number,
    branch: Branch,
    name: string,
    icon: IconMeaning,
    gives: (tier: number) => { line: string; now: string; next?: string },
    options: {
      extra?: Need[];
      sides?: (tier: number) => Side[];
      taken?: (tier: number) => IconMeaning[];
      leadsTo?: string[];
    } = {},
  ): TreeNode => {
    const { tier } = learned(row);
    const next = tier < 4 ? tier + 1 : undefined;
    const needs = next === undefined ? [] : buildingNeeds(row, name, icon, next, options.extra);
    return {
      key,
      row,
      branch,
      icon,
      name,
      tier,
      maxTier: 4,
      state: stateOf(next === undefined, needs),
      nextWord: next === undefined ? undefined : TIER_WORDS[next],
      price: next === undefined ? undefined : researchPrice(row, next),
      needs,
      gives: gives(tier),
      sides: next === undefined ? undefined : options.sides?.(tier),
      taken: options.taken?.(tier) ?? [],
      leadsTo: options.leadsTo ?? [],
    };
  };

  /** Fields, Tools or Drill against Granary, Storeroom or Rations: one more pick on each side. */
  const twoSides = (
    row: number,
    make: { icon: IconMeaning; name: string; line: string; at: (picks: number) => string },
    other: { icon: IconMeaning; name: string; line: string; at: (picks: number) => string },
  ) => {
    const sides = (): Side[] =>
      [make, other].map((side, index) => ({
        icon: side.icon,
        name: side.name,
        line: side.line,
        picks: picks(row, index),
        now: side.at(picks(row, index)),
        next: side.at(picks(row, index) + 1),
      }));
    const taken = () => learned(row).sides.map((side) => (side === 0 ? make.icon : other.icon));
    return { sides, taken };
  };
  const output = (picks: number) => percent((picks * BOARD.outputStepBps) / 100);
  const storage = (picks: number) => percent((picks * BOARD.storageStepBps) / 100);

  const farm = twoSides(
    ROWS.farm,
    { icon: "fields", name: "Fields", line: "Wheat from every Farm", at: output },
    { icon: "granary", name: "Granary", line: "The castle's wheat store", at: storage },
  );
  const workshop = twoSides(
    ROWS.workshop,
    { icon: "tools", name: "Tools", line: "Labor from every Workshop", at: output },
    { icon: "storehouse", name: "Storeroom", line: "The castle's labor store", at: storage },
  );
  const barracks = twoSides(
    ROWS.barracks,
    { icon: "drill", name: "Drill", line: "Troops from every Barracks", at: output },
    {
      icon: "rations",
      name: "Rations",
      line: "Wheat a deployed troop costs",
      at: (picks) => (picks === 0 ? "—" : `−${picks * BOARD.rationStep}`),
    },
  );

  /** A two-sided row's own line: each tier picks a side for the season; its sides say what each adds. */
  const sidesLine = (row: number, made: string) => {
    const { tier } = learned(row);
    return {
      line: `Each tier picks a side for the season: ${made}, or store more`,
      now: TIER_WORDS[tier]!,
      next: tier < 4 ? TIER_WORDS[tier + 1] : undefined,
    };
  };

  const nodes: TreeNode[] = [
    buildingNode("farm", ROWS.farm, "economy", "Farm", "farm", () => sidesLine(ROWS.farm, "make more wheat"), farm),
    buildingNode(
      "workshop",
      ROWS.workshop,
      "economy",
      "Workshop",
      "workshop",
      () => sidesLine(ROWS.workshop, "make more labor"),
      workshop,
    ),
    buildingNode("hut", ROWS.hut, "economy", "Hut", "workers-hut", (tier) => ({
      line: "Population from every Hut",
      now: percent((tier * BOARD.populationStepBps) / 100),
      next: tier < 4 ? percent(((tier + 1) * BOARD.populationStepBps) / 100) : undefined,
    })),
    buildingNode(
      "barracks",
      ROWS.barracks,
      "army",
      "Barracks",
      "barracks",
      (tier) => ({
        line: tier < BOARD.trainingGateTier ? "Rare opens the four training buildings" : "Training buildings open",
        now: TIER_WORDS[tier],
        next: tier < 4 ? TIER_WORDS[tier + 1] : undefined,
      }),
      { ...barracks, leadsTo: TRAINING.map(({ key }) => key) },
    ),
    ...TRAINING.map(({ key, row, name, icon, attribute }) =>
      buildingNode(key, row, "army", name, icon, (tier) => trainingGives(attribute, tier), {
        extra: [
          {
            kind: "tier",
            met: barracksRare,
            node: "Barracks",
            tier: TIER_WORDS[BOARD.trainingGateTier],
            icon: "barracks",
          },
        ],
        ...(row === ROWS.lodge
          ? {
              sides: (tier: number) =>
                KINDS.map((kind, index) => {
                  // A lodge tier `at` starts new armies' Scouting one level higher, on the kind it picked.
                  const now = learned(row)
                    .sides.map((side, at) => (side === index ? scoutingStep(at + 2) : 0))
                    .reduce((sum, step) => sum + step, 0);
                  return {
                    icon: kind.icon,
                    name: kind.name,
                    line: `${kind.name} found by new armies`,
                    picks: picks(row, index),
                    now: percent(now),
                    next: percent(now + scoutingStep(tier + 2)),
                  };
                }),
              taken: () => learned(row).sides.map((side) => KINDS[side]!.icon),
            }
          : {}),
      }),
    ),
    castleNode("shrine", ROWS.shrine, "Shrine", "shrine", {
      line: "Armies find Shrines",
      now: "—",
      next: `+${XP_RULES.fixedXp} XP each`,
    }),
    castleNode("well", ROWS.well, "Well", "well", {
      line: "Armies find Wells",
      now: "—",
      next: `+${WELL_STAMINA} stamina each`,
    }),
    ...([1, 2, 3] as const).map((depth) => reachNode(depth)),
  ];
  return nodes;

  function castleNode(
    key: string,
    row: number,
    name: string,
    icon: IconMeaning,
    gives: TreeNode["gives"],
    tier = 1,
    extra: Need[] = [],
    leadsTo: string[] = [],
  ): TreeNode {
    const done = learned(row).tier >= tier;
    const price = researchPrice(row, tier);
    const needs: Need[] = done
      ? []
      : [...extra, { kind: "essence", met: realm.essence >= price.essence, have: realm.essence, need: price.essence }];
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

  function reachNode(depth: 1 | 2 | 3): TreeNode {
    const numeral = ["I", "II", "III"][depth - 1]!;
    const before = depth === 1 ? [] : [reachNeed(depth - 1)];
    return castleNode(
      `reach-${depth}`,
      ROWS.depth,
      `Reach ${numeral}`,
      (["depth-1", "depth-2", "depth-3"] as const)[depth - 1],
      { line: `Armies enter the Ethereal reach ${numeral} at the spire`, now: "—", next: "Open" },
      depth,
      before,
      depth < 3 ? [`reach-${depth + 1}`] : [],
    );
  }

  function reachNeed(depth: number): Need {
    return {
      kind: "tier",
      met: learned(ROWS.depth).tier >= depth,
      node: `Reach ${["I", "II", "III"][depth - 1]}`,
      tier: "",
      icon: (["depth-1", "depth-2", "depth-3"] as const)[depth - 1]!,
    };
  }
};

/** A training row: the tier every new army of the realm starts that attribute at, and what it gives. */
const trainingGives = (attribute: "battle" | "logistics" | "scouting" | "homecoming", tier: number) => {
  const at = (level: number) => {
    if (attribute === "battle") return `${TIER_WORDS[level - 1]} · ${percent(ATTRIBUTE_AT.battle(level))} damage`;
    if (attribute === "logistics") return `${TIER_WORDS[level - 1]} · ${ATTRIBUTE_AT.logistics(level)} stamina`;
    if (attribute === "scouting") return `${TIER_WORDS[level - 1]} · ${percent(ATTRIBUTE_AT.scouting(level))} finds`;
    return `${TIER_WORDS[level - 1]} · ${ATTRIBUTE_AT.homecoming(level)}% come home`;
  };
  const word = { battle: "Battle", logistics: "Logistics", scouting: "Scouting", homecoming: "Homecoming" }[attribute];
  return { line: `New armies start with ${word}`, now: at(tier + 1), next: tier < 4 ? at(tier + 2) : undefined };
};

/** A node's state from its needs: a missing step locks it; held short of Essence or labor, it waits on them. */
const stateOf = (done: boolean, needs: Need[]): NodeState => {
  if (done) return "done";
  if (needs.some((need) => !need.met && (need.kind === "stands" || need.kind === "tier" || need.kind === "store")))
    return "locked";
  return needs.every((need) => need.met) ? "ready" : "short";
};

/** The first thing a node waits on, as the one line a locked or short node shows. */
export const firstMissing = (node: TreeNode): Need | undefined => node.needs.find((need) => !need.met);

/** A need in a player's words: "Build a Workshop", "Barracks Rare first", "Essence 300 / 1,000". */
export const needLine = (need: Need): string => {
  switch (need.kind) {
    case "stands":
      return need.met ? `${need.building} stands` : `Build a ${need.building}`;
    case "tier":
      return need.tier
        ? `${need.node} ${need.tier}${need.met ? "" : " first"}`
        : `${need.node}${need.met ? "" : " first"}`;
    case "store":
      return `Labor store ${amount(need.limit)} / ${amount(need.need)} · a ${need.level} holds it`;
    case "essence":
      return `Essence ${amount(need.have)} / ${amount(need.need)}`;
    case "labor":
      return `Labor ${amount(need.have)} / ${amount(need.need)}`;
  }
};

export const BRANCHES: { key: Branch; name: string; icon: IconMeaning }[] = [
  { key: "economy", name: "Economy", icon: "farm" },
  { key: "army", name: "Army", icon: "barracks" },
  { key: "castle", name: "Castle", icon: "spire" },
];

export const exactAmount = amount;
