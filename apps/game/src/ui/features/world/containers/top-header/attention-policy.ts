import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Structure, ID } from "@bibliothecadao/types";
import { getBattleTimerLeft } from "@/three/utils/combat-directions";

/**
 * One action on a structure's guards that can set their battle cooldown (a battle, a raid, troops moved into a guard):
 * where it sits on the chain, whose army acted, who held the structure then, and whether it came over the live stream.
 */
export interface GuardAction {
  structureId: number;
  place: ChainPlace;
  live: boolean;
  striker: string | null;
  holder: string | null;
}

/** Block (null while pre-confirmed, so newest), transaction and event: the order the contract wrote actions in. */
type ChainPlace = { block: number | null; transactionIndex: number; eventIndex: number };

/**
 * The player's combat history once it is read: the actions on their structures' guards, who the player is, and whether
 * it is complete: Herald's history held every action through the block the store's facts were read at, so with what
 * this stream has delivered since, no action behind the facts is unread.
 */
export interface CombatHistory {
  actions: readonly GuardAction[];
  isPlayer: (address: string | null) => boolean;
  complete: boolean;
}

/**
 * The structures that need the player now, by id: those under attack (while the battle badge shows it) and those with
 * arrivals waiting. `attackedIds` says which are under attack, for a surface that words the two apart. Without the
 * combat history (still loading, or failed) nothing is under attack: an alert needs the action that caused it.
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
 * Structures under attack: their guards are on a battle cooldown, and the latest action on them was struck by someone
 * else while the player held the structure. The player's own attack, capture or reinforcement is never one.
 */
function attackedStructures(now: number, guards: readonly NativeRows["Guard"][], combat: CombatHistory): Set<number> {
  const onCooldown = guards
    .filter((guard) => getBattleTimerLeft(guard.troops.battle_cooldown_end, now) !== undefined)
    .map((guard) => safeInteger(guard.structure_id));
  return new Set(onCooldown.filter((structureId) => isHostile(currentAction(combat, structureId), combat)));
}

/**
 * The action behind a structure's current cooldown: its latest action, when nothing newer can be unread. Herald sends
 * an action's stories in the same gap-checked diff as its facts, and the client takes the stories first, so within one
 * stream no action newer than a live one is unread. Across a reload, a reconnect or a replacement snapshot, the facts
 * may follow actions whose stories are not read yet: until the history is complete, only a live action vouches, and
 * the structure stays unclassified. Once it is, the latest confirmed or live action does (a pre-confirmed one from an
 * earlier stream may never have landed).
 */
function currentAction(combat: CombatHistory, structureId: number): GuardAction | null {
  const latest = combat.actions
    .filter((action) => action.structureId === structureId)
    .filter((action) => !combat.complete || action.live || action.place.block !== null)
    .reduce<GuardAction | null>(
      (newest, action) => (!newest || isLater(action.place, newest.place) ? action : newest),
      null,
    );
  return latest && (latest.live || combat.complete) ? latest : null;
}

/** Whether one action sits after another on the chain. */
const isLater = (a: ChainPlace, b: ChainPlace): boolean => {
  const block = (place: ChainPlace) => place.block ?? Number.MAX_SAFE_INTEGER;
  return (block(a) - block(b) || a.transactionIndex - b.transactionIndex || a.eventIndex - b.eventIndex) > 0;
};

const isHostile = (action: GuardAction | null, combat: CombatHistory): boolean =>
  action !== null && !combat.isPlayer(action.striker) && combat.isPlayer(action.holder);

export function nextAttentionItem<T extends { key: string }>(items: T[], currentKey: string | null): T | undefined {
  if (items.length === 0) return undefined;
  const currentIndex = items.findIndex((item) => item.key === currentKey);
  return items[(currentIndex + 1) % items.length];
}

/** A story as the attention policy reads it: its kind, its payload, who wrote it, where and how it arrived. */
interface ActionStory {
  story: string;
  owner: string | null;
  storyPayload: Record<string, unknown>;
  position: ChainPlace;
  confirmation: { preconfirmed: boolean; confirmedAfterAttach?: boolean } | null;
  streamGeneration: number | null;
}

/**
 * The actions on structures' guards that stories record. A battle hits the defender's guards and, when a structure's
 * guards strike out, the attacker's own; a raid hits the raided structure's; troops moved into a guard merge their
 * cooldown into it, the player's own act.
 */
export function guardActions(stories: readonly ActionStory[], streamGeneration: number): GuardAction[] {
  return stories.flatMap((event) => {
    const value = event.storyPayload;
    const live = isLive(event, streamGeneration);
    const on = (structureId: unknown, striker: unknown, holder: unknown) =>
      actionOn(event, live, structureId, striker, holder);
    if (event.story === "RaidEvent") return [on(value.structure_id, value.player, value.target_owner)];
    if (event.story === "TroopsTransferred") {
      const guard = (value.target as { Guard?: { structure_id?: unknown } } | undefined)?.Guard;
      return guard ? [on(guard.structure_id, event.owner, event.owner)] : [];
    }
    if (event.story !== "BattleEvent") return [];
    const striker = playerOf(value.attacker);
    return [on(value.defender_id, striker, playerOf(value.defender)), on(value.attacker_id, striker, striker)];
  });
}

const actionOn = (
  event: ActionStory,
  live: boolean,
  structureId: unknown,
  striker: unknown,
  holder: unknown,
): GuardAction => ({
  structureId: safeInteger(structureId as bigint | number | string),
  place: event.position,
  live,
  striker: striker == null ? null : String(striker),
  holder: holder == null ? null : String(holder),
});

/** Delivered by the current stream after its snapshot: pre-confirmed, or confirmed after the socket attached. */
const isLive = ({ confirmation, streamGeneration }: ActionStory, current: number): boolean =>
  streamGeneration === current &&
  Boolean(confirmation && (confirmation.preconfirmed || confirmation.confirmedAfterAttach));

const playerOf = (side: unknown): unknown => (side as { player?: unknown } | undefined)?.player;
