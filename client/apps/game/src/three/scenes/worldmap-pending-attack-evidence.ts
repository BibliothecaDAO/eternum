import { ActorType, type ID } from "@bibliothecadao/types";

interface ExplorerBattleSource {
  explorer_id: ID;
  troops: {
    count: bigint;
    battle_cooldown_end: number;
  };
}

interface GuardBattleSource {
  count: bigint;
  battle_cooldown_end: number;
}

interface StructureBattleSource {
  entity_id: ID;
  troop_guards: {
    alpha: GuardBattleSource;
    bravo: GuardBattleSource;
    charlie: GuardBattleSource;
    delta: GuardBattleSource;
  };
}

export interface PendingAttackEntityEvidence {
  actorType: ActorType;
  entityId: ID;
}

interface PendingAttackParticipants {
  attackerId: ID;
  attackerActorType: ActorType;
  defenderId?: ID;
  defenderActorType?: ActorType;
}

const guardSlots = ["alpha", "bravo", "charlie", "delta"] as const;

export const resolveExplorerBattleEvidence = (
  current: ExplorerBattleSource | undefined,
  previous: ExplorerBattleSource | undefined,
): PendingAttackEntityEvidence | null => {
  const entityId = current?.explorer_id ?? previous?.explorer_id;
  if (entityId === undefined) return null;

  const changed =
    current?.troops.count !== previous?.troops.count ||
    current?.troops.battle_cooldown_end !== previous?.troops.battle_cooldown_end;
  return changed ? { actorType: ActorType.Explorer, entityId } : null;
};

export const resolveStructureBattleEvidence = (
  current: StructureBattleSource | undefined,
  previous: StructureBattleSource | undefined,
): PendingAttackEntityEvidence | null => {
  const entityId = current?.entity_id ?? previous?.entity_id;
  if (entityId === undefined) return null;

  const changed = guardSlots.some(
    (slot) =>
      current?.troop_guards[slot].count !== previous?.troop_guards[slot].count ||
      current?.troop_guards[slot].battle_cooldown_end !== previous?.troop_guards[slot].battle_cooldown_end,
  );
  return changed ? { actorType: ActorType.Structure, entityId } : null;
};

export const matchesPendingAttackEvidence = (
  pending: PendingAttackParticipants,
  evidence: PendingAttackEntityEvidence,
): boolean =>
  (pending.attackerId === evidence.entityId && pending.attackerActorType === evidence.actorType) ||
  (pending.defenderId === evidence.entityId && pending.defenderActorType === evidence.actorType);
