import type { Structure, ID } from "@bibliothecadao/types";
import { getBattleTimerLeft } from "@/three/utils/combat-directions";

export function resolveStructureAttention(structures: Structure[], arrivedStructureIds: ID[], now: number) {
  // Match the map's battle badge: a guard's battle cooldown is still running.
  const attacked = structures.filter(({ structure }) =>
    Object.values(structure.troop_guards).some(
      (guard) =>
        typeof guard === "object" &&
        guard !== null &&
        "battle_cooldown_end" in guard &&
        getBattleTimerLeft(Number(guard.battle_cooldown_end), now) !== undefined,
    ),
  );
  const attentionIds = new Set([...attacked.map((structure) => structure.entityId), ...arrivedStructureIds]);
  const targets = structures
    .filter((structure) => attentionIds.has(structure.entityId))
    .toSorted((a, b) => a.entityId - b.entityId);
  return { attackedCount: attacked.length, targets };
}

export function nextAttentionItem<T extends { key: string }>(items: T[], currentKey: string | null): T | undefined {
  if (items.length === 0) return undefined;
  const currentIndex = items.findIndex(item => item.key === currentKey);
  return items[(currentIndex + 1) % items.length];
}
