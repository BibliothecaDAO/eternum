import { useEffect, useMemo, useState } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import {
  Biome,
  CombatSimulator,
  configManager,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getGuardsByStructure,
  StaminaManager,
  formatTime,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";

import { X } from "lucide-react";
import { CombatModal } from "./combat-modal";
import { useAttackTargetData } from "./hooks/use-attack-target";
import { TargetType } from "./types";

import {
  getDirectionBetweenAdjacentHexes,
  RESOURCE_PRECISION,
  StructureType,
  type TroopType,
  type ActorType,
  type ID,
  type RelicEffectWithEndTick,
  type ResourcesIds,
  type Troops,
  type TroopTier,
} from "@bibliothecadao/types";

interface ActorSummary {
  type: ActorType;
  id: ID;
  hex: { x: number; y: number };
}

interface QuickAttackPreviewProps {
  attacker: ActorSummary;
  target: ActorSummary;
}

enum AttackerType {
  Structure,
  Army,
}

const buildTroopSnapshot = (troops: Troops) => ({
  count: troops.count || 0n,
  category: troops.category as TroopType,
  tier: troops.tier as TroopTier,
  stamina: troops.stamina || { amount: 0n, updated_tick: 0n },
  boosts: troops.boosts || {
    incr_damage_dealt_percent_num: 0,
    incr_damage_dealt_end_tick: 0,
    decr_damage_gotten_percent_num: 0,
    decr_damage_gotten_end_tick: 0,
    incr_stamina_regen_percent_num: 0,
    incr_stamina_regen_tick_count: 0,
    incr_explore_reward_percent_num: 0,
    incr_explore_reward_end_tick: 0,
  },
  battle_cooldown_end: troops.battle_cooldown_end || 0,
});

const toRelicResourceIds = (effects: RelicEffectWithEndTick[]): ResourcesIds[] =>
  effects.map((effect) => Number(effect.id)) as ResourcesIds[];

export const QuickAttackPreview = ({ attacker, target }: QuickAttackPreviewProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { attack_explorer_vs_explorer, attack_explorer_vs_guard, attack_guard_vs_explorer },
      components,
      components: { Structure, ExplorerTroops },
    },
  } = useDojo();

  const accountName = useAccountStore((state) => state.accountName);
  const selectedHex = useUIStore((state) => state.selectedHex);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const {
    attackerRelicEffects,
    targetRelicEffects,
    target: targetData,
    targetResources,
    isLoading,
  } = useAttackTargetData(attacker.id, target.hex);

  const combatConfig = useMemo(() => configManager.getCombatConfig(), []);
  const biome = useMemo(() => Biome.getBiome(target.hex.x, target.hex.y), [target.hex.x, target.hex.y]);
  const combatSimulator = useMemo(() => new CombatSimulator(combatConfig), [combatConfig]);

  const attackerRelicResourceIds = useMemo(() => toRelicResourceIds(attackerRelicEffects), [attackerRelicEffects]);
  const targetRelicResourceIds = useMemo(() => toRelicResourceIds(targetRelicEffects), [targetRelicEffects]);

  const attackerType = useMemo(() => {
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(attacker.id)]));
    return structure ? AttackerType.Structure : AttackerType.Army;
  }, [attacker.id, Structure]);

  const structureGuards = useMemo(() => {
    if (attackerType !== AttackerType.Structure) return [];
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(attacker.id)]));
    return structure ? getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n) : [];
  }, [attackerType, attacker.id, Structure]);

  const attackerStamina = useMemo(() => {
    const { currentArmiesTick } = getBlockTimestamp();

    if (attackerType === AttackerType.Structure) {
      const activeGuard = structureGuards[0];
      if (!activeGuard || !activeGuard.troops.stamina) return 0n;
      return StaminaManager.getStamina(activeGuard.troops, currentArmiesTick).amount;
    }

    return new StaminaManager(components, attacker.id).getStamina(currentArmiesTick).amount;
  }, [attackerType, structureGuards, components, attacker.id]);

  const attackerArmyData: { troops: Troops } | null = useMemo(() => {
    if (attackerType === AttackerType.Structure) {
      const guard = structureGuards[0];
      if (!guard) return null;
      return { troops: buildTroopSnapshot(guard.troops) };
    }

    const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attacker.id)]));
    return army ? { troops: buildTroopSnapshot(army.troops) } : null;
  }, [attackerType, structureGuards, ExplorerTroops, attacker.id]);

  const targetTroopSnapshots = useMemo(() => {
    if (!targetData?.info) return [];
    return targetData.info.map((info) => buildTroopSnapshot(info));
  }, [targetData]);

  const isStructureTarget = targetData?.targetType === TargetType.Structure;
  const targetArmyData: { troops: Troops } | null = useMemo(() => {
    if (!targetTroopSnapshots[0]) return null;
    return { troops: targetTroopSnapshots[0] };
  }, [targetTroopSnapshots]);

  const queuedTargetGuards = useMemo(
    () => (isStructureTarget ? targetTroopSnapshots.slice(1) : []),
    [isStructureTarget, targetTroopSnapshots],
  );

  const totalGuardCount = isStructureTarget ? targetTroopSnapshots.length : 0;
  const hasQueuedGuards = totalGuardCount > 1;

  const isVillageWithoutTroops = useMemo(() => {
    return (
      targetData?.structureCategory === StructureType.Village && (!targetData.info || targetData.info.length === 0)
    );
  }, [targetData]);

  const battleSimulation = useMemo(() => {
    if (!attackerArmyData) return null;
    if (!targetArmyData) return null;

    const attackerArmy = {
      entity_id: attacker.id,
      stamina: Number(attackerStamina),
      troopCount: Number(attackerArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: attackerArmyData.troops.category as TroopType,
      tier: attackerArmyData.troops.tier as TroopTier,
      battle_cooldown_end: attackerArmyData.troops.battle_cooldown_end,
    };

    const defenderArmy = {
      entity_id: targetData?.id || 0,
      stamina: Number(targetArmyData.troops.stamina.amount),
      troopCount: Number(targetArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: targetArmyData.troops.category as TroopType,
      tier: targetArmyData.troops.tier as TroopTier,
      battle_cooldown_end: targetArmyData.troops.battle_cooldown_end,
    };

    const now = Math.floor(Date.now() / 1000);

    return combatSimulator.simulateBattleWithParams(
      now,
      attackerArmy,
      defenderArmy,
      biome,
      attackerRelicResourceIds,
      targetRelicResourceIds,
    );
  }, [
    attacker,
    attackerArmyData,
    targetData,
    targetArmyData,
    biome,
    combatSimulator,
    attackerRelicResourceIds,
    targetRelicResourceIds,
    attackerStamina,
  ]);

  const attackerTroopsTotal = useMemo(() => {
    if (!attackerArmyData) return 0;
    return Number(attackerArmyData.troops.count) / RESOURCE_PRECISION;
  }, [attackerArmyData]);

  const defenderTroopsTotal = useMemo(() => {
    if (!targetArmyData) return 0;
    return Number(targetArmyData.troops.count) / RESOURCE_PRECISION;
  }, [targetArmyData]);

  const attackerLosses = battleSimulation ? Math.min(battleSimulation.defenderDamage, attackerTroopsTotal) : 0;
  const defenderLosses = battleSimulation ? Math.min(battleSimulation.attackerDamage, defenderTroopsTotal) : 0;

  const attackerRemaining = Math.max(attackerTroopsTotal - attackerLosses, 0);
  const defenderRemaining = Math.max(defenderTroopsTotal - defenderLosses, 0);

  const attackerCooldownEnd = Number(attackerArmyData?.troops.battle_cooldown_end ?? 0);
  const attackerCooldownRemaining = Math.max(0, attackerCooldownEnd - currentTime);
  const attackerOnCooldown = attackerCooldownRemaining > 0;

  const attackDisabled =
    attackerOnCooldown ||
    attackerStamina < combatConfig.stamina_attack_req ||
    !attackerArmyData ||
    isVillageWithoutTroops;

  const attackButtonLabel = (() => {
    if (isVillageWithoutTroops) return "Villages cannot be claimed";
    if (attackerOnCooldown) return "On cooldown";
    if (attackerStamina < combatConfig.stamina_attack_req) return `Need ${combatConfig.stamina_attack_req} stamina`;
    if (!attackerArmyData) return "No troops selected";
    return "Attack";
  })();

  const outcomeLabel = (() => {
    if (!battleSimulation) {
      if (targetArmyData) return "Simulating...";
      if (isStructureTarget && hasQueuedGuards) return `${totalGuardCount} guards defending`;
      return "No defenders";
    }

    let baseLabel: string;

    if (battleSimulation.attackerDamage > battleSimulation.defenderDamage) baseLabel = "Victory";
    else if (battleSimulation.attackerDamage === battleSimulation.defenderDamage) baseLabel = "Draw";
    else baseLabel = "Defeat";

    if (!isStructureTarget || !hasQueuedGuards) {
      return baseLabel;
    }

    if (defenderRemaining <= 0) {
      const remaining = queuedTargetGuards.length;
      const suffix = remaining === 1 ? "1 guard remains" : `${remaining} guards remain`;
      return `${baseLabel} • ${suffix}`;
    }

    return `${baseLabel} • Guard 1/${totalGuardCount}`;
  })();

  const handleAttack = async () => {
    if (!selectedHex || !targetData) return;

    try {
      setIsSubmitting(true);

      if (attackerType === AttackerType.Structure) {
        const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
        const guardSlot = structureGuards[0]?.slot;
        if (direction === null || guardSlot === undefined) return;

        await attack_guard_vs_explorer({
          signer: account,
          structure_id: attacker.id,
          structure_guard_slot: guardSlot,
          explorer_id: targetData.id,
          explorer_direction: direction,
        });
      } else if (targetData.targetType === TargetType.Army) {
        const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
        if (direction === null) return;

        await attack_explorer_vs_explorer({
          signer: account,
          aggressor_id: attacker.id,
          defender_id: targetData.id,
          defender_direction: direction,
          steal_resources: targetResources,
        });
      } else {
        const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
        if (direction === null) return;

        await attack_explorer_vs_guard({
          signer: account,
          explorer_id: attacker.id,
          structure_id: targetData.id,
          structure_direction: direction,
        });
      }

      updateSelectedEntityId(null);
      toggleModal(null);
    } catch (error) {
      console.error("Quick attack failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowDetails = () => {
    toggleModal(
      <CombatModal
        selected={{ type: attacker.type, id: attacker.id, hex: attacker.hex }}
        target={{ type: target.type, id: target.id, hex: target.hex }}
      />,
    );
  };

  const formatTroopValue = (value: number) => {
    return Math.round(value).toLocaleString();
  };

  const casualtyLine = (label: string, losses: number, remaining: number, isEliminated: boolean) => (
    <div className="rounded-lg border border-gold/25 bg-dark-brown/80 px-3 py-2 text-xs text-gold/80">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
        <span>{label}</span>
        <span className={isEliminated ? "text-red-300" : "text-emerald-300"}>
          {isEliminated ? "Eliminated" : "Survives"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span>Losses</span>
          <span className="font-semibold text-gold">{formatTroopValue(losses)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span>Remaining</span>
          <span className="font-semibold text-gold">{formatTroopValue(remaining)}</span>
        </span>
      </div>
    </div>
  );

  const guardStatusMessage = (() => {
    if (!isStructureTarget || !hasQueuedGuards) return "";
    if (!battleSimulation || !targetArmyData) {
      return "Multiple guards are protecting this structure. You'll fight them one after another.";
    }

    if (defenderRemaining <= 0) {
      const remaining = queuedTargetGuards.length;
      return remaining === 1
        ? "One more guard will replace this one before you can claim the structure."
        : `${remaining} guards will replace this one before you can claim the structure.`;
    }

    return queuedTargetGuards.length === 1
      ? "Defeat this guard and the final defender will take the field."
      : `Defeat this guard to face ${queuedTargetGuards.length} more guards before you can claim the structure.`;
  })();

  return (
    <div className="w-[280px] max-w-[85vw] rounded-lg border border-gold/30 bg-dark-wood px-3 py-2.5 text-gold shadow-lg">
      <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wide text-gold/60">
        <span>{accountName || "Your army"}</span>
        <div className="flex items-center gap-2">
          <span>{outcomeLabel}</span>
          <button
            type="button"
            aria-label="Close attack preview"
            className="rounded-full border border-gold/30 bg-transparent p-1 text-gold transition hover:bg-gold/10"
            onClick={() => toggleModal(null)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-gold/70">Loading enemy intel...</div>
      ) : !targetData ? (
        <div className="py-6 text-center text-sm text-gold/70">No target detected.</div>
      ) : (
        <div className="space-y-1.5">
          {targetArmyData ? (
            <>
              {casualtyLine("Your forces", attackerLosses, attackerRemaining, attackerRemaining <= 0)}
              {casualtyLine(
                isStructureTarget ? "Active guard" : "Enemy army",
                defenderLosses,
                defenderRemaining,
                defenderRemaining <= 0,
              )}
            </>
          ) : (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
              No defending troops. You can claim without resistance.
            </div>
          )}

          {isStructureTarget && totalGuardCount > 1 && (
            <div className="rounded-lg border border-gold/20 bg-dark-brown/70 px-3 py-2 text-xs text-gold/80">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gold/60">
                <span>More defenders ahead</span>
                <span>{queuedTargetGuards.length} remaining</span>
              </div>
              <p className="mt-1 text-[11px] text-gold/70">{guardStatusMessage}</p>
            </div>
          )}

          {attackDisabled && (
            <div className="rounded-md border border-red-400/30 bg-red-900/20 px-3 py-2 text-xs text-red-200">
              <span>{attackButtonLabel}</span>
              {attackerOnCooldown && attackerCooldownRemaining > 0 && (
                <div className="mt-1 text-[11px] text-gold/70">{formatTime(attackerCooldownRemaining)} remaining</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="md"
          disabled={attackDisabled || !targetData || isLoading}
          isLoading={isSubmitting}
          onClick={handleAttack}
          forceUppercase={false}
          className="px-3 py-1 text-xs tracking-wide"
        >
          Attack
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={handleShowDetails}
          forceUppercase={false}
          className="px-3 py-1 text-xs tracking-wide"
        >
          Details
        </Button>
      </div>
    </div>
  );
};
