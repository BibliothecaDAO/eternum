export const ROUTES = [
  {
    id: "display",
    title: "Common I → Legendary V",
    summary: "Shipping display route: five states, four upgrades. Training buildings grant II.",
    tradeoff: "No new rank, research price, effect or model. Keep the current research budgets and storage hurdles.",
  },
  {
    id: "insert",
    title: "Add a rank before Legendary",
    summary: "Next-season alternative: Common has no gem; Uncommon I → Rare II → Epic III → Exalted IV → Legendary V.",
    tradeoff:
      "Exalted is a working name. Split the final payment and effect into two steps. Same total research budget and final power; lower individual storage hurdles.",
  },
] as const;
export type RouteId = (typeof ROUTES)[number]["id"];
export const BRANCHES = ["Economy", "Barracks", "Training", "Castle"] as const;
export type Branch = (typeof BRANCHES)[number];
const RANKS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
const INSERT_RANKS = ["Common", "Uncommon", "Rare", "Epic", "Exalted", "Legendary"] as const;
export const NUMERALS = ["I", "II", "III", "IV", "V"] as const;
export const BUILDINGS = {
  farm: { name: "Farm", essence: 1000, labor: 1000, build: 400, population: 1 },
  workshop: { name: "Workshop", essence: 2000, labor: 2000, build: 2000, population: 2 },
  barracks: { name: "Barracks", essence: 4000, labor: 3000, build: 400, population: 3 },
  hut: { name: "Hut", essence: 500, labor: 500, build: 300, population: 0 },
  training: { name: "Training building", essence: 12000, labor: 3000, build: 3000, population: 2 },
} as const;
export type Building = keyof typeof BUILDINGS;
const ESSENCE = { display: [0, 1, 4, 12, 30], insert: [0, 1, 4, 12, 12, 18] };
const LABOR = { display: [0, 1, 3, 8, 20], insert: [0, 1, 3, 8, 8, 12] };
export function ranks(route: RouteId) {
  return route === "display" ? RANKS : INSERT_RANKS;
}
export function steps(route: RouteId) {
  return route === "display" ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 3.5, 4];
}
export function price(building: Building, rank: number, route: RouteId) {
  const base = BUILDINGS[building];
  if (building === "training" && rank === 1) return { essence: 0, labor: base.build, action: "Build" };
  return {
    essence: base.essence * ESSENCE[route][rank]!,
    labor: base.labor * LABOR[route][rank]!,
    action: rank === 0 ? "Base" : "Research",
  };
}
export function budget(building: Building, route: RouteId) {
  return ranks(route).reduce(
    (total, _, rank) => {
      const cost = price(building, rank, route);
      return { essence: total.essence + cost.essence, labor: total.labor + cost.labor };
    },
    { essence: 0, labor: 0 },
  );
}
export function number(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}
export function priceText(building: Building, rank: number, route: RouteId) {
  const cost = price(building, rank, route);
  return rank === 0
    ? "No research"
    : cost.action === "Build"
      ? "Build · 3k labor"
      : `${number(cost.essence / 1000)}k E / ${number(cost.labor / 1000)}k L`;
}
export const ECONOMY = [
  { name: "Fields", building: "farm", effect: "output" },
  { name: "Granary", building: "farm", effect: "storage" },
  { name: "Tools", building: "workshop", effect: "output" },
  { name: "Storeroom", building: "workshop", effect: "storage" },
  { name: "Hut capacity", building: "hut", effect: "population" },
] as const;
export const BARRACKS = [
  { name: "Drill", building: "barracks", effect: "output" },
  { name: "Rations", building: "barracks", effect: "rations" },
] as const;
export function economyEffect(effect: "output" | "storage" | "population" | "rations", step: number) {
  if (effect === "output") return `${number(100 + step * 25)}% output`;
  if (effect === "storage") return `${number(100 + step * 50)}% capacity`;
  if (effect === "population") return `${6 + Math.floor(6 * step * 0.25)} people / Hut`;
  return `${number(2 - step * 0.25)} wheat / troop`;
}
export const TRAINING = [
  { name: "War hall", attribute: "Battle", values: [0, 10, 30, 60, 100], unit: "% damage" },
  { name: "Supply yard", attribute: "Logistics", values: [0, 20, 50, 90, 150], unit: " max stamina" },
  { name: "Scouts’ lodge", attribute: "Scouting", values: [0, 10, 30, 60, 100], unit: "% of kind’s base chance" },
  { name: "Hearth", attribute: "Homecoming", values: [0, 3, 9, 18, 30], unit: "% survivors return" },
] as const;
export function trainingEffect(index: number, rank: number, route: RouteId) {
  const step = steps(route)[rank]!;
  const values = TRAINING[index]!.values;
  const lower = Math.floor(step),
    upper = Math.ceil(step);
  const amount = values[lower]! + (values[upper]! - values[lower]!) * (step - lower);
  return `${index === 3 ? "" : "+"}${number(amount)}${TRAINING[index]!.unit}`;
}
export function stillPath(route: RouteId, branch: Branch, device: "desktop" | "phone" = "desktop") {
  return `/lab/army-tree/${route}-${branch.toLowerCase()}-${device}.png`;
}
