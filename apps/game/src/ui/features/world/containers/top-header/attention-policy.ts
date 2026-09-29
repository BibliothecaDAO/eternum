import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Structure, ID } from "@bibliothecadao/types";
import { getBattleTimerLeft } from "@/three/utils/combat-directions";

export function resolveStructureAttention(
  structures: Structure[],
  arrivedStructureIds: ID[],
  now: number,
  guards: readonly NativeRows["Guard"][],
) {
  const attackedIds = new Set(
    guards
      .filter((guard) => getBattleTimerLeft(guard.troops.battle_cooldown_end, now) !== undefined)
      .map((guard) => guard.structure_id),
  );
  const attacked = structures.filter((structure) => attackedIds.has(structure.entityId));
  const attentionIds = new Set([...attacked.map((structure) => structure.entityId), ...arrivedStructureIds]);
  const targets = structures
    .filter((structure) => attentionIds.has(structure.entityId))
    .toSorted((a, b) => a.entityId - b.entityId);
  return { attackedCount: attacked.length, targets };
}

export function nextAttentionItem<T extends { key: string }>(items: T[], currentKey: string | null): T | undefined {
  if (items.length === 0) return undefined;
  const currentIndex = items.findIndex((item) => item.key === currentKey);
  return items[(currentIndex + 1) % items.length];
}
