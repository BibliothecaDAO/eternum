import { useStoredBiome } from "@/hooks/helpers/use-tile-at";
import { type MouseEvent, useEffect, useMemo, useState } from "react";

import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useBlockTimestamp, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { Checkbox } from "@/ui/design-system/atoms/checkbox";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_CUE, HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { getTierStyle } from "@/ui/utils/tier-styles";
import {
  activeCombatRules,
  COMBAT_DIE_FACES,
  configManager,
  forecastFight,
  resolveExchange,
  formatTime,
  getGuardsByStructure,
  getTroopResourceId,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";

import { X } from "@/ui/design-system/atoms/game-icons";
import { buildAttackStaminaRequirementLabel, resolveAttackStaminaState } from "./attack-stamina-state";
import { getStructureDefenseSlotLimit, getUnlockedGuardSlots } from "../utils/defense-slot-utils";
import { formatAcross, survivalOf, type SideRange } from "./battle-range";
import { CombatModal } from "./combat-modal";
import { describeFight, wholeTroops } from "./fight-forecast";
import { useAttackTargetData } from "./hooks/use-attack-target";
import { AttackTarget, TargetType } from "./types";

import {
  BiomeType,
  getDirectionBetweenAdjacentHexes,
  getLayeredAttackDistance,
  getTroopAttackRange,
  RESOURCE_PRECISION,
  resources,
  TickIds,
  type ActorType,
  type ID,
  type Troops,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

interface ActorSummary {
  type: ActorType;
  id: ID;
  hex: { x: number; y: number };
  /** The map layer the actor stands on; every caller knows it, so a preview never guesses the surface. */
  alt: boolean;
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
  battle_cooldown_end: troops.battle_cooldown_end,
});

const buildProjectedTroopSnapshot = (
  troops: Troops,
  stamina: { amount: bigint; updated_tick: bigint } = troops.stamina,
) => ({
  ...buildTroopSnapshot(troops),
  stamina,
});

/** Each side's losses at both ends of the dice, from this attack's exact exchanges; null when the attack is refused. */
const exchangeSides = (
  worst: ReturnType<typeof resolveExchange>,
  best: ReturnType<typeof resolveExchange>,
): { attacker: SideRange; defender: SideRange } | null => {
  if (!worst.ok || !best.ok) return null;
  const side = (loss: bigint, remaining: bigint) => ({ losses: wholeTroops(loss), remaining: wholeTroops(remaining) });
  return {
    attacker: {
      worst: side(worst.attackerLoss, worst.attacker.count),
      best: side(best.attackerLoss, best.attacker.count),
    },
    defender: {
      worst: side(worst.defenderLoss, worst.defender.count),
      best: side(best.defenderLoss, best.defender.count),
    },
  };
};

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
      store,
    },
  } = useGame();
  const revision = useNativeRevision(["Structure", "Guard", "ExplorerTroops", "TileOccupancy"]);

  const accountName = usePlayerDisplayName(account?.address);
  const selectedHex = useUIStore((state) => state.selectedHex);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Opt-in toggle: when on, the Claim action also garrisons the surviving troops. Off by default.
  const [garrisonEnabled, setGarrisonEnabled] = useState(false);

  const currentTime = useNowSeconds();
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();

  const { target: targetData, targetResources, isLoading } = useAttackTargetData(attacker.id, target.hex, target.alt);

  const combatConfig = useMemo(() => configManager.getCombatConfig(), []);
  const ethereal = target.alt;
  const surfaceBiome = useStoredBiome(target.hex.x, target.hex.y) ?? BiomeType.None;
  const biome = ethereal ? BiomeType.Underground : surfaceBiome;
  const rollsDice = useMemo(() => configManager.rollsCombatDice(ethereal), [ethereal]);

  const attackerType = useMemo(() => {
    const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: attacker.id });
    return structure ? AttackerType.Structure : AttackerType.Army;
  }, [attacker.id, store, revision]);

  const structureGuards = useMemo(() => {
    if (attackerType !== AttackerType.Structure) return [];
    const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: attacker.id });
    return structure
      ? getGuardsByStructure(structure, store)
          ?.filter((guard) => guard.troops.count > 0n)
          .toSorted((a, b) => a.slot - b.slot)
      : [];
  }, [attackerType, attacker.id, store, revision]);

  // Hex distance from the attacker to the target. Crossbowmen can poke at range 2; everything else
  // is adjacency-only, so this drives which guards may fire and whether a structure can be claimed.
  const targetDistance = useMemo(() => {
    if (!selectedHex) return Infinity;
    return getLayeredAttackDistance(
      { ...selectedHex, alt: attacker.alt },
      { col: target.hex.x, row: target.hex.y, alt: target.alt },
    );
  }, [selectedHex, attacker.alt, target.alt, target.hex.x, target.hex.y]);

  // When a structure is the aggressor, only guards whose attack range reaches the target can fire.
  const eligibleStructureGuards = useMemo(
    () => structureGuards?.filter((guard) => getTroopAttackRange(guard.troops.category) >= targetDistance) ?? [],
    [structureGuards, targetDistance],
  );

  const activeGuard = attackerType === AttackerType.Structure ? eligibleStructureGuards[0] : undefined;

  const attackerStamina = useMemo(() => {
    if (attackerType === AttackerType.Structure) {
      if (!activeGuard || !activeGuard.troops.stamina) return 0n;
      return StaminaManager.getStamina(activeGuard.troops, currentArmiesTick).amount;
    }

    return new StaminaManager(store, attacker.id).getStamina(currentArmiesTick)?.amount ?? 0n;
  }, [attackerType, activeGuard, store, attacker.id, currentArmiesTick]);

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

    const army = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: attacker.id });
    return army
      ? {
          troops: buildProjectedTroopSnapshot(army.troops, {
            amount: attackerStamina,
            updated_tick: BigInt(currentArmiesTick),
          }),
        }
      : null;
  }, [store, revision, attacker.id, attackerStamina, attackerType, currentArmiesTick, activeGuard]);

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

  // Every exchange is the contract's own arithmetic on both sides' troops, stamina and boosts at chain time: this
  // attack and the whole fight as successive attacks now. Where the game rolls dice, both at the attacker's worst roll
  // against the defender's best and the reverse; without dice the two ends are one exact result.
  const fight = useMemo(() => {
    if (!attackerArmyData || !targetArmyData) return null;
    const rules = activeCombatRules();
    const at = (attackerRoll: number, defenderRoll: number) => {
      const context = {
        timestamp: currentTime,
        currentTick: currentArmiesTick,
        attackDistance: targetDistance,
        attackerBiome: biome,
        defenderBiome: biome,
        attackerIsStructureGuard: attackerType === AttackerType.Structure,
        defenderIsStructureGuard: isStructureTarget,
        attackerRoll,
        defenderRoll,
      };
      return {
        exchange: resolveExchange(attackerArmyData.troops, targetArmyData.troops, context, rules),
        forecast: forecastFight(attackerArmyData.troops, targetArmyData.troops, context, rules),
      };
    };
    if (!rollsDice) {
      const exact = at(0, 0);
      return { worst: exact, best: exact };
    }
    return { worst: at(1, COMBAT_DIE_FACES), best: at(COMBAT_DIE_FACES, 1) };
  }, [
    attackerArmyData,
    targetArmyData,
    currentTime,
    currentArmiesTick,
    targetDistance,
    biome,
    attackerType,
    isStructureTarget,
    rollsDice,
  ]);

  const attackerTroopsTotal = useMemo(() => {
    if (!attackerArmyData) return 0;
    return Number(attackerArmyData.troops.count) / RESOURCE_PRECISION;
  }, [attackerArmyData]);

  const defenderTroopsTotal = useMemo(() => {
    if (!targetArmyData) return 0;
    return Number(targetArmyData.troops.count) / RESOURCE_PRECISION;
  }, [targetArmyData]);

  const sides = fight ? exchangeSides(fight.worst.exchange, fight.best.exchange) : null;
  const attackerSide = sides?.attacker ?? null;
  const defenderSide = sides?.defender ?? null;

  // Capture and garrison are judged on the attacker's worst roll, so the atomic claim never counts on luck.
  const attackerRemaining = attackerSide ? attackerSide.worst.remaining : attackerTroopsTotal;
  const defenderRemaining = defenderSide ? defenderSide.worst.remaining : defenderTroopsTotal;

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
    // A structure whose level this client does not know takes no garrison: its cap is unknown.
    const structureLevel = targetData?.structureLevel;
    if (!willCaptureStructure || !attackerArmyData || structureLevel == null) return 0;
    const survivors = targetArmyData ? attackerRemaining : attackerTroopsTotal;
    const buffered = Math.floor(survivors * 0.99);
    const maxArmySize = configManager.getMaxArmySize(structureLevel, attackerArmyData.troops.tier as TroopTier);
    return Math.max(0, Math.min(buffered, maxArmySize));
  }, [willCaptureStructure, attackerArmyData, targetArmyData, attackerRemaining, attackerTroopsTotal, targetData]);

  const canGarrison = !ethereal && willCaptureStructure && garrisonGuardSlot !== null && garrisonTroopCount >= 1;

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
    if (!fight) {
      if (isStructureTarget && hasQueuedGuards) return `${totalGuardCount} guards defending`;
      return "No defenders";
    }

    const [worst, best] = [describeFight(fight.worst.forecast), describeFight(fight.best.forecast)];
    const baseLabel = worst === best ? (worst ?? "—") : `Worst roll: ${worst ?? "—"} · best: ${best ?? "—"}`;

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

  const handleShowDetails = (event: MouseEvent<HTMLButtonElement>) => {
    openSurface({
      id: "combat-details",
      anchor: surfaceAnchorFrom(event.currentTarget),
      placement: "beside",
      content: (
        <CombatModal
          selected={{ type: attacker.type, id: attacker.id, hex: attacker.hex, alt: attacker.alt }}
          target={{ type: target.type, id: target.id, hex: target.hex, alt: target.alt }}
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

  const casualtyLine = (label: string, side: SideRange) => {
    const survival = survivalOf(side);
    return (
      <div className="rounded-md border border-gold/20 bg-black/25 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className={HUD_LABEL}>{label}</span>
          <span
            className={cn(
              HUD_CUE,
              survival === "Eliminated"
                ? "text-red-300"
                : survival === "Survives"
                  ? "text-emerald-300"
                  : "text-amber-300",
            )}
          >
            {survival}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <span className={HUD_CUE}>Losses</span>
            <span className={HUD_VALUE}>{formatAcross(side.worst.losses, side.best.losses, formatTroopValue)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className={HUD_CUE}>Remaining</span>
            <span className={HUD_VALUE}>
              {formatAcross(side.worst.remaining, side.best.remaining, formatTroopValue)}
            </span>
          </span>
        </div>
      </div>
    );
  };

  if (structureGuards === undefined) return <div>Loading guards…</div>;

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
          {rollsDice && (
            <p className="text-xs text-gold/70">
              Each side rolls a d20 for +1% to +20% damage; ranges run from your worst roll to your best.
            </p>
          )}
          {targetArmyData ? (
            attackerSide &&
            defenderSide && (
              <>
                {casualtyLine("Your forces", attackerSide)}
                {casualtyLine(isStructureTarget ? "Active guard" : "Enemy army", defenderSide)}
              </>
            )
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
