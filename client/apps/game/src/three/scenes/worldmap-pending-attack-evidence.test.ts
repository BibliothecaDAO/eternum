import { ActorType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  matchesPendingAttackEvidence,
  resolveExplorerBattleEvidence,
  resolveStructureBattleEvidence,
} from "./worldmap-pending-attack-evidence";

const explorer = (count: bigint, cooldown = 0) => ({
  explorer_id: 7,
  troops: { count, battle_cooldown_end: cooldown },
});

const structure = (alphaCount: bigint, cooldown = 0) => ({
  entity_id: 9,
  troop_guards: {
    alpha: { count: alphaCount, battle_cooldown_end: cooldown },
    bravo: { count: 0n, battle_cooldown_end: 0 },
    charlie: { count: 0n, battle_cooldown_end: 0 },
    delta: { count: 0n, battle_cooldown_end: 0 },
  },
});

describe("pending attack entity evidence", () => {
  it("convicts an explorer troop-count or cooldown change", () => {
    expect(resolveExplorerBattleEvidence(explorer(8n), explorer(10n))).toEqual({
      actorType: ActorType.Explorer,
      entityId: 7,
    });
    expect(resolveExplorerBattleEvidence(explorer(10n, 20), explorer(10n, 0))).toEqual({
      actorType: ActorType.Explorer,
      entityId: 7,
    });
    expect(resolveExplorerBattleEvidence(explorer(10n), explorer(10n))).toBeNull();
  });

  it("convicts a structure guard troop-count or cooldown change", () => {
    expect(resolveStructureBattleEvidence(structure(8n), structure(10n))).toEqual({
      actorType: ActorType.Structure,
      entityId: 9,
    });
    expect(resolveStructureBattleEvidence(structure(10n, 20), structure(10n))).toEqual({
      actorType: ActorType.Structure,
      entityId: 9,
    });
    expect(resolveStructureBattleEvidence(structure(10n), structure(10n))).toBeNull();
  });

  it("matches participant identity and actor kind together", () => {
    const pending = {
      attackerId: 7,
      attackerActorType: ActorType.Explorer,
      defenderId: 9,
      defenderActorType: ActorType.Structure,
    };

    expect(matchesPendingAttackEvidence(pending, { actorType: ActorType.Structure, entityId: 9 })).toBe(true);
    expect(matchesPendingAttackEvidence(pending, { actorType: ActorType.Explorer, entityId: 9 })).toBe(false);
  });
});
