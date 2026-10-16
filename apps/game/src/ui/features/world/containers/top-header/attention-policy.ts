import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Structure, ID } from "@bibliothecadao/types";
import { getBattleTimerLeft } from "@/three/utils/combat-directions";

/** One hit on a structure's guards, from a battle or a raid: when, whose army struck, and who held the structure then. */
export interface GuardHit {
  structureId: number;
  at: number;
  striker: string | null;
  holder: string | null;
}

/** The player's combat history once it is read: their structures' hits, the cooldown one hit adds, who the player is. */
export interface CombatHistory {
  hits: readonly GuardHit[];
  cooldownSeconds: number;
  isPlayer: (address: string | null) => boolean;
}

/**
 * The structures that need the player now, by id: those under attack (while the battle badge shows it) and those with
 * arrivals waiting. `attackedIds` says which are under attack, for a surface that words the two apart. Without the
 * combat history (still loading, or failed) nothing is under attack: an alert needs the hit that caused it.
 */
export function resolveStructureAttention(
  structures: Structure[],
  arrivedStructureIds: ID[],
  now: number,
  guards: readonly NativeRows["Guard"][],
  combat: CombatHistory | null,
) {
  const attackedIds = combat ? attackedStructures(now, guards, combat) : new Set<number>();
  const attacked = structures.filter((structure) => attackedIds.has(structure.entityId));
  const attentionIds = new Set([...attacked.map((structure) => structure.entityId), ...arrivedStructureIds]);
  const targets = structures
    .filter((structure) => attentionIds.has(structure.entityId))
    .toSorted((a, b) => a.entityId - b.entityId);
  return { attackedCount: attacked.length, attackedIds, targets };
}

/**
 * Structures under attack: their guards are on a battle cooldown, and the hit behind that cooldown was struck by someone
 * else while the player held the structure. The player's own attack or capture is never one.
 */
function attackedStructures(now: number, guards: readonly NativeRows["Guard"][], combat: CombatHistory): Set<number> {
  const cooldownEnds = new Map<number, number>();
  for (const guard of guards) {
    const end = guard.troops.battle_cooldown_end;
    if (getBattleTimerLeft(end, now) === undefined) continue;
    const structureId = safeInteger(guard.structure_id);
    cooldownEnds.set(structureId, Math.max(end, cooldownEnds.get(structureId) ?? 0));
  }
  const attacked = [...cooldownEnds].filter(([structureId, end]) =>
    isHostileHit(hitBehindCooldown(combat, structureId, end), combat),
  );
  return new Set(attacked.map(([structureId]) => structureId));
}

/**
 * The hit behind a structure's current cooldown: its latest known hit, once the known hits account for the cooldown's
 * end (each hit adds at most one cooldown). Null when they cannot, as when the hit that set it is not read yet.
 */
function hitBehindCooldown(combat: CombatHistory, structureId: number, cooldownEnd: number): GuardHit | null {
  const hits = combat.hits.filter((hit) => hit.structureId === structureId).toSorted((a, b) => a.at - b.at);
  const reach = hits.reduce((end, hit) => Math.max(end, hit.at) + combat.cooldownSeconds, 0);
  return hits.length > 0 && reach >= cooldownEnd ? hits[hits.length - 1] : null;
}

const isHostileHit = (hit: GuardHit | null, combat: CombatHistory): boolean =>
  hit !== null && !combat.isPlayer(hit.striker) && combat.isPlayer(hit.holder);

export function nextAttentionItem<T extends { key: string }>(items: T[], currentKey: string | null): T | undefined {
  if (items.length === 0) return undefined;
  const currentIndex = items.findIndex((item) => item.key === currentKey);
  return items[(currentIndex + 1) % items.length];
}

/**
 * The hits on structures' guards that battles and raids record. A battle hits the defender's guards and, when a
 * structure's guards strike out, the attacker's own.
 */
export function guardHits(
  stories: readonly { story: string; timestamp: string; storyPayload: Record<string, unknown> }[],
): GuardHit[] {
  return stories.flatMap(({ story, timestamp, storyPayload: value }) => {
    const at = Number(timestamp);
    if (story === "RaidEvent") return [hitOn(value.structure_id, at, value.player, value.target_owner)];
    if (story !== "BattleEvent") return [];
    const striker = playerOf(value.attacker);
    return [
      hitOn(value.defender_id, at, striker, playerOf(value.defender)),
      hitOn(value.attacker_id, at, striker, striker),
    ];
  });
}

const hitOn = (structureId: unknown, at: number, striker: unknown, holder: unknown): GuardHit => ({
  structureId: safeInteger(structureId as bigint | number | string),
  at,
  striker: striker == null ? null : String(striker),
  holder: holder == null ? null : String(holder),
});

const playerOf = (side: unknown): unknown => (side as { player?: unknown } | undefined)?.player;
