import { EARLY_REALM } from "@/ui/features/frontier/research/progression-fixture";

export type TreeRule = "independent" | "budget" | "current";
export type StorageRule = "cut" | "capacity";
export type Counts = readonly [number, number];
export type StudyRow = 0 | 1 | 2;

export const TREE_OPTIONS = [
  {
    key: "independent",
    label: "T1 · Separate levels",
    detail: "Recommended · Each side has four upgrades and its own prices. Buying one never closes the other.",
  },
  {
    key: "budget",
    label: "T2 · Four picks total",
    detail:
      "Each side has its own prices, but both share four purchases. A fully upgraded side still closes the other.",
  },
  {
    key: "current",
    label: "T3 · Keep today’s rule",
    detail:
      "Four purchases shared by both sides. Choose either side each time; the next price rises whichever side you pick.",
  },
] as const;
export const STORAGE_OPTIONS = [
  {
    key: "cut",
    label: "S1 · Cut storage research",
    detail: "Recommended · The realm sets capacity. Farms and Workshops research production only.",
  },
  {
    key: "capacity",
    label: "S2 · Make storage matter later",
    detail:
      "Keep storage research; smaller Kingdom and Empire stores create a choice between storage, Rations and smaller deployments.",
  },
] as const;
export const ROWS = [
  { row: 0, name: "Farm", icon: "farm", sides: ["Fields", "Granary"], baseRate: 302.4, unit: "wheat / hour" },
  { row: 1, name: "Workshop", icon: "workshop", sides: ["Tools", "Storeroom"], baseRate: 201.6, unit: "labor / hour" },
  { row: 2, name: "Barracks", icon: "barracks", sides: ["Drill", "Rations"], baseRate: 100.8, unit: "troops / hour" },
] as const;
export const REALMS = ["Settlement", "City", "Kingdom", "Empire"];
export const LIVE_CAPACITY = [6000, 18000, 50000, 120000];
const PROPOSED_CAPACITY = [6000, 18000, 40000, 80000];
export const DEPTHS = [
  { name: "Surface", weak: [300, 350], strong: [450, 550], camp: [1000, 1600] },
  { name: "Depth I", weak: [900, 1050], strong: [1350, 1650], camp: [3000, 5000] },
  { name: "Depth II", weak: [2400, 2800], strong: [3600, 4400], camp: [8000, 12000] },
  { name: "Depth III", weak: [6000, 7000], strong: [9000, 11000], camp: [20000, 30000] },
] as const;

// First defender count for each of the 28 cleared beast sites in perf's 20261022T214805Z history pull.
const CLEARED_BEAST_GUARDS = [
  330, 310, 475, 320, 459, 342, 337, 528, 469, 494, 309, 314, 311, 311, 455, 511, 336, 464, 526, 339, 317, 339, 327,
  537, 485, 316, 483, 485,
];
export const CAMP_LABOR = 4950;
export const REVEAL_LABOR = 20002;
export const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 3 });

export function nextPrice(row: StudyRow, counts: Counts, side: number, rule: TreeRule) {
  const total = counts[0] + counts[1];
  if (counts[side]! >= 4 || (rule !== "independent" && total >= 4)) return undefined;
  return EARLY_REALM.price(row, (rule === "current" ? total : counts[side]!) + 1);
}

export function capacity(level: number, picks: number, rule: StorageRule | "current") {
  const base = (rule === "capacity" ? PROPOSED_CAPACITY : LIVE_CAPACITY)[level]!;
  return base * (1 + (rule === "cut" ? 0 : picks * 0.5));
}

export function effect(row: StudyRow, side: number, picks: number, level: number, storage: StorageRule | "current") {
  const item = ROWS[row];
  if (side === 0) return `${number(item.baseRate * (1 + picks * 0.25))} ${item.unit}`;
  if (row === 2) return `${number(2 - picks * 0.25)} wheat / deployed troop`;
  return `${number(capacity(level, picks, storage))} ${row === 0 ? "wheat" : "labor"} capacity`;
}

export function beastReplay(divisor: number) {
  const payouts = CLEARED_BEAST_GUARDS.map((guard) => guard / divisor).sort((a, b) => a - b);
  return { total: payouts.reduce((sum, value) => sum + value, 0), median: (payouts[13]! + payouts[14]!) / 2 };
}
