import { useEffect, useMemo, useState } from "react";

import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { Checkbox } from "@/ui/design-system/atoms/checkbox";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_CUE, HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { getTierStyle } from "@/ui/utils/tier-styles";
import {
  CombatSimulator,
  configManager,
  DEFAULT_COORD_ALT,
  formatTime,
  getEntityIdFromKeys,
  getGuardsByStructure,
  getTroopResourceId,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";

import X from "lucide-react/dist/esm/icons/x";
import { buildAttackStaminaRequirementLabel, resolveAttackStaminaState } from "./attack-stamina-state";
import { getStructureDefenseSlotLimit, getUnlockedGuardSlots } from "../utils/defense-slot-utils";
import { CombatModal } from "./combat-modal";
import { useAttackTargetData } from "./hooks/use-attack-target";
import { AttackTarget, TargetType } from "./types";
import { gameEntityKey } from "@/sync/game-scope";

import {
  getDirectionBetweenAdjacentHexes,
  getHexDistance,
  getTroopAttackRange,
  RESOURCE_PRECISION,
  resources,
  TickIds,
  type ActorType,
  type ID,
  type RelicEffectWithEndTick,
  type ResourcesIds,
  type Troops,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

interface ActorSummary {
  type: ActorType;
  id: ID;
  hex: { x: number; y: number };
  alt?: boolean;
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

const buildProjectedTroopSnapshot = (
  troops: Troops,
  stamina: { amount: bigint; updated_tick: bigint } = troops.stamina || { amount: 0n, updated_tick: 0n },
) => ({
  ...buildTroopSnapshot(troops),
  stamina,
});

const toRelicResourceIds = (effects: RelicEffectWithEndTick[]): ResourcesIds[] =>
  effects.map((effect) => Number(effect.id)) as ResourcesIds[];

export const QuickAttackPreview = ({ attacker, target }: QuickAttackPreviewProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: {
        attack_explorer_vs_explorer,
        attack_explorer_vs_guard,
        attack_explorer_vs_guard_and_garrison,
        attack_guard_vs_explorer,
      },
      components,
      components: { Structure, ExplorerTroops },
    },
  } = useDojo();

  const accountName = useAccountStore((state) => state.accountName);
  const selectedHex = useUIStore((state) => state.selectedHex);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Opt-in toggle: when on, the Claim action also garrisons the surviving troops. Off by default.
  const [garrisonEnabled, setGarrisonEnabled] = useState(false);

  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();

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
  } = useAttackTargetData(attacker.id, target.hex, target.alt ?? DEFAULT_COORD_ALT);

  const combatConfig = useMemo(() => configManager.getCombatConfig(), []);
  const biome = useMemo(() => configManager.getBiome(target.hex.x, target.hex.y), [target.hex.x, target.hex.y]);
  const combatSimulator = useMemo(() => new CombatSimulator(combatConfig), [combatConfig]);

  const attackerRelicResourceIds = useMemo(() => toRelicResourceIds(attackerRelicEffects), [attackerRelicEffects]);
  const targetRelicResourceIds = useMemo(() => toRelicResourceIds(targetRelicEffects), [targetRelicEffects]);

  const attackerType = useMemo(() => {
    const structure = getComponentValue(Structure, gameEntityKey([BigInt(attacker.id)]));
    return structure ? AttackerType.Structure : AttackerType.Army;
  }, [attacker.id, Structure]);

  const structureGuards = useMemo(() => {
    if (attackerType !== AttackerType.Structure) return [];
    const structure = getComponentValue(Structure, gameEntityKey([BigInt(attacker.id)]));
    return structure
      ? getGuardsByStructure(structure)
          .filter((guard) => guard.troops.count > 0n)
          .toSorted((a, b) => a.slot - b.slot)
      : [];
  }, [attackerType, attacker.id, Structure]);

  // Hex distance from the attacker to the target. Crossbowmen can poke at range 2; everything else
  // is adjacency-only, so this drives which guards may fire and whether a structure can be claimed.
  const targetDistance = useMemo(() => {
    if (!selectedHex) return Infinity;
    return getHexDistance(selectedHex, { col: target.hex.x, row: target.hex.y });
  }, [selectedHex, target.hex.x, target.hex.y]);

  // When a structure is the aggressor, only guards whose attack range reaches the target can fire.
  const eligibleStructureGuards = useMemo(
    () => structureGuards.filter((guard) => getTroopAttackRange(guard.troops.category) >= targetDistance),
    [structureGuards, targetDistance],
  );

  const activeGuard = attackerType === AttackerType.Structure ? eligibleStructureGuards[0] : undefined;

  const attackerStamina = useMemo(() => {
    if (attackerType === AttackerType.Structure) {
      if (!activeGuard || !activeGuard.troops.stamina) return 0n;
      return StaminaManager.getStamina(activeGuard.troops, currentArmiesTick).amount;
    }

    return new StaminaManager(components, attacker.id).getStamina(currentArmiesTick).amount;
  }, [attackerType, activeGuard, components, attacker.id, currentArmiesTick]);

  const attackerStaminaValue = Number(attackerStamina);
  const requiredAttackStamina = Number(combatConfig.stamina_attack_req);

  const staminaWaitSeconds = useMemo(() => {
    if (attackerStaminaValue >= requiredAttackStamina) return 0;

    const deficit = requiredAttackStamina - attackerStaminaValue;
    const refillPerTick = Number(configManager.getRefillPerTick());
    const tickDuration = Number(configManager.getTick(TickIds.Armies));

    if (!Number.isFinite(deficit) || !Number.isFinite(refillPerTick) || !Number.isFinite(tickDuration)) {
      return null;
    }
    if (deficit <= 0) return 0;
    if (refillPerTick <= 0 || tickDuration <= 0) return null;

    const ticksNeeded = Math.ceil(deficit / refillPerTick);
    const timeToNextArmiesTick = Math.max(0, Math.ceil(armiesTickTimeRemaining));

    if (ticksNeeded <= 0) return 0;

    return timeToNextArmiesTick + Math.max(0, ticksNeeded - 1) * tickDuration;
  }, [attackerStaminaValue, requiredAttackStamina, armiesTickTimeRemaining]);

  const attackerArmyData: { troops: Troops } | null = useMemo(() => {
    if (attackerType === AttackerType.Structure) {
      const guard = activeGuard;
      if (!guard) return null;
      return {
        troops: buildProjectedTroopSnapshot(guard.troops, {
          amount: attackerStamina,
          updated_tick: BigInt(currentArmiesTick),
        }),
      };
    }

    const army = getComponentValue(ExplorerTroops, gameEntityKey([BigInt(attacker.id)]));
    return army
      ? {
          troops: buildProjectedTroopSnapshot(army.troops, {
            amount: attackerStamina,
            updated_tick: BigInt(currentArmiesTick),
          }),
        }
      : null;
  }, [ExplorerTroops, attacker.id, attackerStamina, attackerType, currentArmiesTick, activeGuard]);

  const targetTroopSnapshots = useMemo(() => {
    if (!targetData?.info) return [];
    return targetData.info.map((info) => buildProjectedTroopSnapshot(info, info.stamina));
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

  // Combat v3 context so the preview reflects ranged reductions, no counter-damage, and the
  // ranged stamina/cooldown model rather than always simulating an adjacent melee.
  const combatSimulationContext = useMemo(
    () => ({
      attackDistance: targetDistance,
      attackerIsStructureGuard: attackerType === AttackerType.Structure,
      defenderIsStructureGuard: isStructureTarget,
    }),
    [targetDistance, attackerType, isStructureTarget],
  );

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
      combatSimulationContext,
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
    combatSimulationContext,
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

  // Per-slot defender view: the active guard (slot 0) shows its projected
  // post-fight remainder, queued guards show their untouched troop counts.
  const defenderSlots = useMemo(() => {
    if (!isStructureTarget) return [];
    return targetTroopSnapshots.map((snapshot, index) => {
      const isActive = index === 0;
      const remaining = isActive ? defenderRemaining : Number(snapshot.count) / RESOURCE_PRECISION;
      const resourceId = getTroopResourceId(snapshot.category as TroopType, snapshot.tier as TroopTier);
      const trait = resources.find((resource) => resource.id === resourceId)?.trait ?? "";
      return { tier: snapshot.tier as TroopTier, trait, remaining, isActive, eliminated: remaining <= 0 };
    });
  }, [isStructureTarget, targetTroopSnapshots, defenderRemaining]);

  const attackerIsArmy = attackerType === AttackerType.Army;

  // The attack captures the structure when it clears every remaining defender and the attacker
  // survives — and only from an adjacent hex, since ranged pokes cannot claim.
  const clearsAllDefenders =
    isStructureTarget && (!targetArmyData || (defenderRemaining <= 0 && queuedTargetGuards.length === 0));
  const attackerSurvivesCapture = !targetArmyData || attackerRemaining > 0;
  const willCaptureStructure = attackerIsArmy && clearsAllDefenders && attackerSurvivesCapture && targetDistance <= 1;

  // First open guard slot the captured structure exposes (defeated guards leave their slot empty,
  // so a swap into it inherits the explorer's category/tier).
  const garrisonGuardSlot = useMemo(() => {
    if (!willCaptureStructure || !targetData) return null;
    const slotLimit =
      targetData.guardSlotLimit ??
      getStructureDefenseSlotLimit(targetData.structureCategory ?? undefined, targetData.structureLevel ?? null);
    const [firstSlot] = getUnlockedGuardSlots(slotLimit);
    return firstSlot ?? null;
  }, [willCaptureStructure, targetData]);

  // Troops to garrison: a 1% buffer below the simulated survivor count so a tick-boundary divergence
  // between this preview and the on-chain combat result can't revert the atomic attack+swap multicall
  // (the guard swap asserts count <= live troops; the buffer also leaves >=1 troop on the explorer),
  // then capped to the structure's max guard army size so the swap never overfills the slot.
  const garrisonTroopCount = useMemo(() => {
    if (!willCaptureStructure || !attackerArmyData) return 0;
    const survivors = targetArmyData ? attackerRemaining : attackerTroopsTotal;
    const buffered = Math.floor(survivors * 0.99);
    const maxArmySize = configManager.getMaxArmySize(
      Number(targetData?.structureLevel ?? 0),
      attackerArmyData.troops.tier as TroopTier,
    );
    return Math.max(0, Math.min(buffered, maxArmySize));
  }, [willCaptureStructure, attackerArmyData, targetArmyData, attackerRemaining, attackerTroopsTotal, targetData]);

  const canGarrison = willCaptureStructure && garrisonGuardSlot !== null && garrisonTroopCount >= 1;

  // Reset the opt-in toggle when the target stops being garrison-able so a stale "on" state can't
  // carry over to a different target.
  useEffect(() => {
    if (!canGarrison) {
      setGarrisonEnabled(false);
    }
  }, [canGarrison]);

  const attackerCooldownEnd = Number(attackerArmyData?.troops.battle_cooldown_end ?? 0);
  const attackerCooldownRemaining = Math.max(0, attackerCooldownEnd - currentTime);
  const attackerOnCooldown = attackerCooldownRemaining > 0;

  const hasDefenders = !!targetArmyData;
  const attackStaminaState = useMemo(
    () =>
      resolveAttackStaminaState({
        attackerStamina,
        hasAttackerTroops: Boolean(attackerArmyData),
        hasDefenders,
        requiredStamina: requiredAttackStamina,
      }),
    [attackerArmyData, attackerStamina, hasDefenders, requiredAttackStamina],
  );
  const cooldownBlocksAttack = hasDefenders && attackerOnCooldown;
  // A ranged poke can clear guards but never claims — the structure must be taken from an adjacent hex.
  const rangedClaimBlocked = !hasDefenders && isStructureTarget && targetDistance > 1;
  const attackDisabled =
    rangedClaimBlocked || cooldownBlocksAttack || attackStaminaState.isBlocked || !attackerArmyData;

  const isLowStamina = attackStaminaState.isBlocked;

  const attackButtonLabel = (() => {
    if (rangedClaimBlocked) return "Move adjacent to claim";
    if (attackerType === AttackerType.Structure && !activeGuard) return "No guard in range";
    if (!attackerArmyData) return "No troops selected";
    if (cooldownBlocksAttack) return "On cooldown";
    if (attackStaminaState.isBlocked) return buildAttackStaminaRequirementLabel(attackStaminaState);
    if (!hasDefenders) return "Claim";
    return attackStaminaState.actionLabel;
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

  // Shared submit pipeline: guards, pending worldmap FX, sound, and teardown are identical across
  // every attack variant — only the system call differs, so callers just provide that call.
  const runWorldmapAttack = async (
    performCall: (ctx: { direction: number | null; resolvedTarget: AttackTarget }) => Promise<unknown>,
  ) => {
    if (!selectedHex || !targetData || attackDisabled) return;
    // Range-2 pokes are not adjacent, so direction is null for them; only the adjacency-only
    // garrison multicall requires it, and it guards for null itself.
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
    const resolvedTarget = targetData;

    try {
      setIsSubmitting(true);

      playUnitCommandSound("attack");
      await performCall({ direction, resolvedTarget });

      updateSelectedEntityId(null);
      closeSurface();
    } catch (error) {
      console.error("Quick attack failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttack = () =>
    runWorldmapAttack(async ({ resolvedTarget }) => {
      // Combat v3 derives battle range from coordinates onchain, so no direction is passed.
      if (attackerType === AttackerType.Structure) {
        const guardSlot = activeGuard?.slot;
        if (guardSlot === undefined) throw new Error("No structure guard is selected");

        return attack_guard_vs_explorer({
          signer: account,
          structure_id: attacker.id,
          structure_guard_slot: guardSlot,
          explorer_id: resolvedTarget.id,
        });
      } else if (resolvedTarget.targetType === TargetType.Army) {
        return attack_explorer_vs_explorer({
          signer: account,
          aggressor_id: attacker.id,
          defender_id: resolvedTarget.id,
          steal_resources: targetResources,
        });
      } else {
        return attack_explorer_vs_guard({
          signer: account,
          explorer_id: attacker.id,
          structure_id: resolvedTarget.id,
        });
      }
    });

  // Capture the structure and, in the same atomic multicall, garrison the surviving troops into its
  // first open guard slot. Claiming requires adjacency, so a direction is always available here.
  const handleClaimAndGarrison = () =>
    runWorldmapAttack(async ({ direction, resolvedTarget }) => {
      if (direction === null || garrisonGuardSlot === null || garrisonTroopCount < 1) {
        throw new Error("No valid garrison target is selected");
      }

      return attack_explorer_vs_guard_and_garrison({
        signer: account,
        explorer_id: attacker.id,
        structure_id: resolvedTarget.id,
        structure_direction: direction,
        to_guard_slot: garrisonGuardSlot,
        count: garrisonTroopCount * RESOURCE_PRECISION,
      });
    });

  // The Claim button garrisons the survivors only when the opt-in toggle is enabled.
  const handlePrimaryAction = () => (canGarrison && garrisonEnabled ? handleClaimAndGarrison() : handleAttack());

  const handleShowDetails = () => {
    openSurface({
      id: "combat-details",
      content: (
        <CombatModal
          selected={{ type: attacker.type, id: attacker.id, hex: attacker.hex }}
          target={{ type: target.type, id: target.id, hex: target.hex }}
        />
      ),
    });
  };

  const formatTroopValue = (value: number) => {
    return Math.round(value).toLocaleString();
  };

  const renderDetailsButton = (extraClassName?: string) => (
    <Button
      variant="outline"
      size="md"
      onClick={handleShowDetails}
      forceUppercase={false}
      className={cn("px-3 py-1 text-xs tracking-wide", extraClassName)}
    >
      Details
    </Button>
  );

  const casualtyLine = (label: string, losses: number, remaining: number, isEliminated: boolean) => (
    <div className="rounded-md border border-gold/20 bg-black/25 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className={HUD_LABEL}>{label}</span>
        <span className={cn(HUD_CUE, isEliminated ? "text-red-300" : "text-emerald-300")}>
          {isEliminated ? "Eliminated" : "Survives"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1">
          <span className={HUD_CUE}>Losses</span>
          <span className={HUD_VALUE}>{formatTroopValue(losses)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className={HUD_CUE}>Remaining</span>
          <span className={HUD_VALUE}>{formatTroopValue(remaining)}</span>
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-[280px] max-w-[85vw] px-3 py-2.5 text-gold">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn("truncate", HUD_LABEL)}>{accountName || "Your army"}</span>
        <div className="flex items-center gap-2">
          <span className={cn("shrink-0", HUD_CUE)}>{outcomeLabel}</span>
          <button
            type="button"
            aria-label="Close attack preview"
            className="rounded-full border border-gold/30 bg-transparent p-1 text-gold transition hover:bg-gold/10"
            onClick={closeSurface}
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
              {rangedClaimBlocked
                ? "No defending troops. Move adjacent to claim this structure."
                : "No defending troops. You can claim without resistance."}
            </div>
          )}

          {isStructureTarget && totalGuardCount >= 1 && (
            <div className="rounded-md border border-gold/20 bg-black/25 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className={HUD_LABEL}>Defenders</span>
                <span className={HUD_CUE}>Post Fight</span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {defenderSlots.map((slot, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold border leading-none",
                        getTierStyle(slot.tier),
                      )}
                    >
                      {slot.tier}
                    </span>
                    {slot.trait && (
                      <ResourceIcon withTooltip={false} resource={slot.trait} size="sm" className="shrink-0" />
                    )}
                    <span
                      className={cn(
                        "tabular-nums",
                        HUD_VALUE,
                        slot.eliminated && "text-red-300 line-through decoration-red-300/60",
                      )}
                    >
                      {formatTroopValue(slot.remaining)}
                    </span>
                    {slot.isActive && <span className={cn("ml-auto", HUD_CUE)}>Active</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {attackDisabled && (
            <div className="rounded-md border border-red-400/30 bg-red-900/20 px-3 py-2 text-xs text-red-200">
              <span>{attackButtonLabel}</span>
              {cooldownBlocksAttack && attackerCooldownRemaining > 0 && (
                <div className="mt-1 text-[11px] text-gold/70">{formatTime(attackerCooldownRemaining)} remaining</div>
              )}
              {isLowStamina && (
                <div className="mt-1 text-[11px] text-gold/70">
                  <div>
                    Current: {attackerStaminaValue} / Required: {requiredAttackStamina}
                  </div>
                  {staminaWaitSeconds !== null && <div>Ready in: {formatTime(staminaWaitSeconds)}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {canGarrison && (
        <div className="modal-no-drag mt-1.5 flex items-center justify-between rounded-md border border-gold/20 bg-black/25 px-3 py-2">
          <Checkbox
            enabled={garrisonEnabled}
            onClick={() => setGarrisonEnabled((enabled) => !enabled)}
            text="Garrison survivors"
          />
          <span className={cn("tabular-nums", HUD_VALUE)}>{formatTroopValue(garrisonTroopCount)}</span>
        </div>
      )}

      <div className="modal-no-drag mt-2 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="md"
          disabled={attackDisabled || !targetData || isLoading}
          isLoading={isSubmitting}
          onClick={handlePrimaryAction}
          forceUppercase={false}
          className="px-3 py-1 text-xs tracking-wide"
        >
          {rangedClaimBlocked ? "Move adjacent to claim" : willCaptureStructure ? "Claim" : "Attack"}
        </Button>
        {renderDetailsButton()}
      </div>
    </div>
  );
};
