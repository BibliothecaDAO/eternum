import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Structure, ID } from "@bibliothecadao/types";
import { getBattleTimerLeft } from "@/three/utils/combat-directions";

/**
 * The structures that need the player now, by id: those under attack (while the battle badge shows it) and those with
 * arrivals waiting. `attackedIds` says which are under attack, for a surface that words the two apart. A battle the
 * player fought there themselves (`ownBattles`: they attacked it, or captured it) is never "under attack".
 */
export function resolveStructureAttention(
  structures: Structure[],
  arrivedStructureIds: ID[],
  now: number,
  guards: readonly NativeRows["Guard"][],
  ownBattles: ReadonlySet<number> = new Set(),
) {
  const attackedIds = new Set(
    guards
      .filter((guard) => getBattleTimerLeft(guard.troops.battle_cooldown_end, now) !== undefined)
      .map((guard) => safeInteger(guard.structure_id))
      .filter((structureId) => !ownBattles.has(structureId)),
  );
  const attacked = structures.filter((structure) => attackedIds.has(structure.entityId));
  const attentionIds = new Set([...attacked.map((structure) => structure.entityId), ...arrivedStructureIds]);
  const targets = structures
    .filter((structure) => attentionIds.has(structure.entityId))
    .toSorted((a, b) => a.entityId - b.entityId);
  return { attackedCount: attacked.length, attackedIds, targets };
}

export function nextAttentionItem<T extends { key: string }>(items: T[], currentKey: string | null): T | undefined {
  if (items.length === 0) return undefined;
  const currentIndex = items.findIndex((item) => item.key === currentKey);
  return items[(currentIndex + 1) % items.length];
}

/**
 * The structures whose latest battle the player started (a capture, an attack on one's own): newest battle story per
 * defender, kept when its attacker is the player.
 */
export function ownBattleStructures(
  battles: readonly { storyPayload: Record<string, unknown> }[],
  isPlayer: (address: unknown) => boolean,
): Set<number> {
  const latest = new Map<number, boolean>();
  for (const { storyPayload } of battles) {
    const defender = storyPayload.defender_id;
    if (defender == null) continue;
    const id = safeInteger(defender as bigint | number | string);
    if (latest.has(id)) continue;
    latest.set(id, isPlayer((storyPayload.attacker as { player?: unknown } | undefined)?.player));
  }
  return new Set([...latest].filter(([, own]) => own).map(([id]) => id));
}
