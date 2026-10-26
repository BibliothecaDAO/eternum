export const SCENES = ["Research", "Army", "Level up"] as const;
export const OPTIONS = [
  {
    id: "a",
    title: "A · Train at the castle",
    summary: "Research starting ranks. Earn points on expeditions. Remove the four training buildings.",
    path: "Two Barracks upgrades → castle training → deploy → earn XP → spend a point.",
    removes: "War hall, Supply yard, Scouts’ lodge and Hearth; their plots, population costs and separate build step.",
    tradeoff:
      "First rank costs 3,000 labor with no refund. Today a 3,000-labor building can be demolished for 1,500 back while keeping its training.",
  },
  {
    id: "b",
    title: "B · Learn on expeditions",
    summary: "Every army starts Common. XP points are its only path to stronger attributes.",
    path: "Deploy → earn 50 XP → choose a rank. Later points cost 100, 150, 200… XP.",
    removes: "The four training buildings, their four research rows, trained starts and the training unlock gate.",
    tradeoff:
      "The biggest cut, but no permanent investment in future armies. The observed median army still earns less than 50 XP.",
  },
  {
    id: "c",
    title: "C · Keep the training buildings",
    summary: "Build for a starting rank, research better starts, then earn expedition points.",
    path: "Two Barracks upgrades → training building grants rank I → research → deploy → earn points.",
    removes: "Per-attribute XP prices and pip rows. Keeps all four buildings, their space and population costs.",
    tradeoff:
      "Keeps the longest path: a building is needed to improve its row, but demolition keeps training and refunds half its build labor.",
  },
] as const;
export type OptionId = "today" | (typeof OPTIONS)[number]["id"];
export type Scene = (typeof SCENES)[number];
export const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Homecoming"] as const;
export const RANKS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
export const NUMERALS = ["I", "II", "III", "IV", "V"] as const;
const CUMULATIVE = [0, 100, 180, 240, 280] as const;
const BASE = [10, 20, 10, 3] as const;
const TODAY = [
  [0, 10, 30, 60, 100],
  [0, 20, 50, 90, 150],
  [0, 10, 30, 60, 100],
  [0, 3, 9, 18, 30],
];

export function bonus(attribute: number, rank: number, today = false) {
  return today ? TODAY[attribute]![rank]! : (BASE[attribute]! * CUMULATIVE[rank]!) / 100;
}
export function gain(attribute: number, rank: number, today = false) {
  return bonus(attribute, rank + 1, today) - bonus(attribute, rank, today);
}
export function effect(attribute: number, amount: number) {
  const value = Number(amount.toFixed(1));
  return [`+${value}% damage`, `+${value} max stamina`, `Beasts +${value}% base chance`, `${value}% survivors return`][
    attribute
  ]!;
}
export function earnedPoints(xp: number, trainedRanks: number) {
  const cap = 16 - trainedRanks;
  let points = 0;
  while (points < cap && xp >= 25 * (points + 1) * (points + 2)) points++;
  return points;
}
export function stillPath(option: OptionId, scene: Scene) {
  return `/lab/army-tree/${option}-${scene.toLowerCase().replaceAll(" ", "-")}.png`;
}
