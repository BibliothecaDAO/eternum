import { EARLY_ARMY } from "@/ui/features/frontier/research/progression-fixture";
import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";

export type LevelOption = "flat" | "diminishing";
export type Counts = [number, number, number, number];
export type ScoutKind = "Beasts" | "Camps" | "Rifts";
export const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Homecoming"] as const;
export const PRICES = EARLY_ARMY.levelXp;
export const OPTIONS = {
  flat: { label: "1 · Flat gains (previous)" },
  diminishing: { label: "2 · Diminishing gains" },
} as const;
const BASE = [1000, 20, 1000, 300] as const;
const CUMULATIVE = [0, 100, 180, 240, 280] as const;
const STEP = [100, 80, 60, 40] as const;

/** Both proposals use the same XP curve; training fills slots without advancing earned experience. */
export function levelProgress(xp: number, trained: Counts) {
  const cap = 16 - trained.reduce((sum, points) => sum + points, 0);
  const threshold = (points: number) => 25 * points * (points + 1);
  let points = 0;
  while (points < cap && xp >= threshold(points + 1)) points++;
  const capped = points === cap;
  return {
    points,
    level: points + 1,
    capped,
    into: capped ? 0 : xp - threshold(points),
    next: capped ? 0 : 50 * (points + 1),
  };
}

export function training(choice: string): Counts {
  if (choice === "battle-1") return [1, 0, 0, 0];
  if (choice === "battle-2") return [2, 0, 0, 0];
  if (choice === "scouting-2") return [0, 0, 2, 0];
  if (choice === "battle-4") return [4, 0, 0, 0];
  if (choice === "all") return [4, 4, 4, 4];
  return [0, 0, 0, 0];
}

/** Percent attributes use basis points; Logistics uses whole stamina. */
function bonus(attribute: number, points: number, option: LevelOption | "today") {
  if (option !== "today")
    return option === "flat" ? BASE[attribute]! * points : (BASE[attribute]! * CUMULATIVE[points]!) / 100;
  if (attribute === 0) return battleBonusBps(points + 1);
  if (attribute === 1) return logisticsStamina(points + 1);
  return homecomingBps(points + 1);
}

function scoutStep(points: number, option: LevelOption | "today") {
  if (option === "today") return scoutingIncrementBps(points + 2) / 100;
  return option === "flat" ? 10 : STEP[points]! / 10;
}

export function gain(attribute: number, points: number, option: LevelOption | "today") {
  if (attribute === 2) return `+${scoutStep(points, option)}% of the chosen kind's base discovery rate`;
  const units = bonus(attribute, points + 1, option) - bonus(attribute, points, option);
  if (attribute === 0) return `+${units / 100}% damage`;
  if (attribute === 1) return `+${units} max stamina`;
  return `+${units / 100}% of survivors returned`;
}

export function effect(attribute: number, points: number, option: LevelOption | "today", kinds: ScoutKind[]) {
  if (attribute === 0) return `+${bonus(attribute, points, option) / 100}% damage`;
  if (attribute === 1) return `+${bonus(attribute, points, option)} max stamina`;
  if (attribute === 3) return `${bonus(attribute, points, option) / 100}% return home`;
  if (!points) return "No discovery bonus";
  const bonuses = new Map<ScoutKind, number>();
  kinds.forEach((kind, index) => bonuses.set(kind, (bonuses.get(kind) ?? 0) + scoutStep(index, option)));
  return [...bonuses].map(([kind, value]) => `${kind} +${value}%`).join(" · ");
}
