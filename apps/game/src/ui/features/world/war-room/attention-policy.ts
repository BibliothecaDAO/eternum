import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Structure } from "@bibliothecadao/types";
import { getBattleTimerLeft } from "@/three/utils/combat-directions";

type AttentionReason = "attacked" | "arrived";

/**
 * The structures that need the player now, each once: those under attack first, then those with arrivals waiting.
 * An attack lasts as long as the battle badge shows it.
 */
export function resolveStructureAttention(
  structures: Structure[],
  arrivedStructureIds: number[],
  now: number,
  guards: readonly NativeRows["Guard"][],
): { structure: Structure; reason: AttentionReason }[] {
  const attackedIds = new Set(
    guards
      .filter((guard) => getBattleTimerLeft(guard.troops.battle_cooldown_end, now) !== undefined)
      .map((guard) => safeInteger(guard.structure_id)),
  );
  const arrivedIds = new Set(arrivedStructureIds);
  const byId = structures.toSorted((a, b) => a.entityId - b.entityId);
  return [
    ...byId
      .filter((structure) => attackedIds.has(structure.entityId))
      .map((structure) => ({ structure, reason: "attacked" as const })),
    ...byId
      .filter((structure) => arrivedIds.has(structure.entityId) && !attackedIds.has(structure.entityId))
      .map((structure) => ({ structure, reason: "arrived" as const })),
  ];
}
