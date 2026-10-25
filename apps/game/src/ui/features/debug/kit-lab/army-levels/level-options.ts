import { EARLY_ARMY } from "@/ui/features/frontier/research/progression-fixture";
import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";

export type LevelOption = "flat" | "growing";
export type Counts = [number, number, number, number];
export type ScoutKind = "Beasts" | "Camps" | "Rifts";
export const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Homecoming"] as const;
export const PRICES = EARLY_ARMY.levelXp;
export const OPTIONS = {
  flat: { label: "1 · Flat bonuses", step: 50 },
  growing: { label: "2 · Growing bonuses", step: 100 },
} as const;

/** Lab proposals only. Training fills attribute slots but does not advance the earned-XP curve. */
export function levelProgress(xp: number, trained: Counts, option: LevelOption) {
  const cap = 16 - trained.reduce((sum, points) => sum + points, 0);
  const step = OPTIONS[option].step;
  const threshold = (points: number) => (step * points * (points + 1)) / 2;
  let points = 0;
  while (points < cap && xp >= threshold(points + 1)) points++;
  const capped = points === cap;
  return {
    points,
    level: points + 1,
    capped,
    into: capped ? 0 : xp - threshold(points),
    next: capped ? 0 : step * (points + 1),
  };
}

export function training(choice: string): Counts {
  if (choice === "battle-1") return [1, 0, 0, 0];
  if (choice === "battle-4") return [4, 0, 0, 0];
  if (choice === "all") return [4, 4, 4, 4];
  return [0, 0, 0, 0];
}

export function effect(attribute: number, points: number, option: LevelOption | "today", kinds: ScoutKind[]) {
  const flat = option === "flat";
  if (attribute === 0) return `+${flat ? points * 10 : battleBonusBps(points + 1) / 100}% damage`;
  if (attribute === 1) return `+${flat ? points * 20 : logisticsStamina(points + 1)} max stamina`;
  if (attribute === 3) return `${flat ? points * 3 : homecomingBps(points + 1) / 100}% return home`;
  if (!points) return "No discovery bonus";
  const bonuses = new Map<ScoutKind, number>();
  kinds.forEach((kind, index) =>
    bonuses.set(kind, (bonuses.get(kind) ?? 0) + (flat ? 10 : scoutingIncrementBps(index + 2) / 100)),
  );
  return [...bonuses].map(([kind, bonus]) => `${kind} +${bonus}%`).join(" · ");
}
