import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useStoredBiome } from "@/hooks/helpers/use-tile-at";
import { type MouseEvent, useEffect, useMemo, useState } from "react";

import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useNowSeconds, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudActions, HudButton, HudCheck, HudIconButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { configManager, getGuardsByStructure, getTroopResourceId, StaminaManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";

import { buildAttackStaminaRequirementLabel, resolveAttackStaminaState } from "./attack-stamina-state";
import { formatAcross, survivalOf, type SideRange } from "./battle-range";
import { CombatModal } from "./combat-modal";
import { combatTitle, describeFightCost, forecastAttack } from "./fight-forecast";
import { readSurvivalAdvice } from "./survival-advice";
import { useAttackTargetData } from "./hooks/use-attack-target";
import { AttackTarget, TargetType } from "./types";

import {
  BiomeType,
  getDirectionBetweenAdjacentHexes,
  getLayeredAttackDistance,
  getTroopAttackRange,
  RESOURCE_PRECISION,
  type ActorType,
  type ID,
  type Troops,
  formatWait,
  formatExact,
} from "@bibliothecadao/types";
import { TierChip } from "../utils/tier-chip";
import { toast } from "@/ui/features/event-feed/notify";

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
    },
  } = useGame();
  const facts = useNativeFacts([
    "ArmySlot",
    "Structure",
    "Guard",
    "ExplorerTroops",
    "TileOccupancy",
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
  ]);

  const accountName = usePlayerDisplayName(account?.address);
  const selectedHex = useUIStore((state) => state.selectedHex);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const deselectEntity = useUIStore((state) => state.deselectEntity);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Opt-in toggle: when on, the Claim action also garrisons the surviving troops. Off by default.
  const [garrisonEnabled, setGarrisonEnabled] = useState(false);

  const currentTime = useNowSeconds();
  const executionSecond = useCurrentDefaultTick();

  const { target: targetData, targetResources, isLoading } = useAttackTargetData(attacker.id, target.hex, target.alt);
  const targetOwnerName = usePlayerDisplayName(targetData ? (targetData.addressOwner ?? 0n) : null);

  const combatConfig = useMemo(() => configManager.getCombatConfig(), []);
  const ethereal = target.alt;
  const surfaceBiome = useStoredBiome(target.hex.x, target.hex.y) ?? BiomeType.None;
  const biome = ethereal ? BiomeType.Underground : surfaceBiome;
  const rollsDice = useMemo(() => configManager.rollsCombatDice(ethereal), [ethereal]);

  const attackerType = useMemo(() => {
    const structure = facts.store.get("Structure", {
      game_id: configManager.getActiveGameId(),
      entity_id: attacker.id,
    });
    return structure ? AttackerType.Structure : AttackerType.Army;
  }, [attacker.id, facts]);

  const structureGuards = useMemo(() => {
    if (attackerType !== AttackerType.Structure) return [];
    const structure = facts.store.get("Structure", {
      game_id: configManager.getActiveGameId(),
      entity_id: attacker.id,
    });
    return structure
      ? getGuardsByStructure(structure, facts.store)
          ?.filter((guard) => guard.troops.count > 0n)
          .toSorted((a, b) => a.slot - b.slot)
      : [];
  }, [attackerType, attacker.id, facts]);

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

  const attackerArmyData: { troops: Troops } | null = useMemo(() => {
    if (attackerType === AttackerType.Structure) return activeGuard ? { troops: activeGuard.troops } : null;
    const army = facts.store.get("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: attacker.id,
    });
    const troops = army ? resolveExplorerTroops(facts.store, army) : undefined;
    return troops ? { troops } : null;
  }, [facts, attacker.id, attackerType, activeGuard]);
  const attackerStamina = attackerArmyData
    ? StaminaManager.getStamina(attackerArmyData.troops, executionSecond).amount
    : undefined;
  const attackerStaminaValue = attackerStamina === undefined ? undefined : Number(attackerStamina);
  const requiredAttackStamina = Number(combatConfig.stamina_attack_req);
  const readyAt = attackerArmyData
    ? StaminaManager.getAffordableAt(attackerArmyData.troops, requiredAttackStamina, executionSecond)
    : null;
  const staminaWaitSeconds = readyAt === null ? null : Math.max(0, readyAt - executionSecond);

  const targetTroopSnapshots = useMemo(() => targetData?.info ?? [], [targetData]);

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

  // Every exchange is the contract's own arithmetic on both sides' troops, stamina and boosts at chain time: this
  // attack and the whole fight as successive attacks now, at both ends of the dice.
  const fight = useMemo(() => {
    if (!attackerArmyData || !targetArmyData) return null;
    return forecastAttack(
      attackerArmyData.troops,
      targetArmyData.troops,
      {
        timestamp: executionSecond,
        attackDistance: targetDistance,
        attackerBiome: biome,
        defenderBiome: biome,
        attackerIsStructureGuard: attackerType === AttackerType.Structure,
        defenderIsStructureGuard: isStructureTarget,
      },
      { rules: configManager.getCombatRules(), rollsDice },
    );
  }, [
    attackerArmyData,
    targetArmyData,
    executionSecond,
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

  const attackerSide = fight?.sides?.attacker ?? null;
  const defenderSide = fight?.sides?.defender ?? null;
  // The army falls at every roll: Attack steps back and the forecast says what would survive.
  const certainLoss = fight?.certainLoss ?? false;
  // What would survive it, within what the player can raise.
  const survivalAdvice = useMemo(() => {
    if (!fight?.extraToSurvive || !attackerArmyData) return null;
    const armyId = attackerType === AttackerType.Army ? attacker.id : null;
    return readSurvivalAdvice(
      facts.store,
      { id: armyId, troops: attackerArmyData.troops },
      fight.extraToSurvive,
      executionSecond,
    );
  }, [fight, attackerArmyData, attackerType, attacker.id, facts, executionSecond]);

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
      const resourceId = getTroopResourceId(snapshot.category, snapshot.tier);
      return { tier: snapshot.tier, resourceId, remaining, isActive, eliminated: remaining <= 0 };
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
    const [firstSlot] = targetData.guardSlots ?? [];
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
    const maxArmySize = configManager.getMaxArmySize(structureLevel, attackerArmyData.troops.tier);
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

  // Who survives and what each side loses are the casualty lines below; the title only names the sides.
  const title = combatTitle(accountName, targetOwnerName);
  const fightCost = (() => {
    if (!fight) return null;
    const [worst, best] = [describeFightCost(fight.worst.forecast), describeFightCost(fight.best.forecast)];
    return worst === best ? worst : `Worst roll: ${worst ?? "—"} · best: ${best ?? "—"}`;
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

      deselectEntity();
      closeSurface();
    } catch (error) {
      toast.failed(error, "The attack failed.");
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
    return formatExact(Math.round(value));
  };

  const casualtyLine = (label: string, side: SideRange) => {
    const survival = survivalOf(side);
    return (
      <div className="rounded-md border border-hud-line bg-hud-well px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-hud-label text-hud-muted">{label}</span>
          <span
            className={cn(
              "text-hud-label",
              survival === "Eliminated" ? "text-hud-bad" : survival === "Survives" ? "text-hud-good" : "text-hud-warn",
            )}
          >
            {survival}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <span className="text-hud-label text-hud-cue">Losses</span>
            <span className="text-hud-strong">
              {formatAcross(side.worst.losses, side.best.losses, formatTroopValue)}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-hud-label text-hud-cue">Remaining</span>
            <span className="text-hud-strong">
              {formatAcross(side.worst.remaining, side.best.remaining, formatTroopValue)}
            </span>
          </span>
        </div>
      </div>
    );
  };

  if (structureGuards === undefined) return <div>Loading guards…</div>;

  return (
    <div className="w-72 max-w-full px-3 py-2.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-hud-label text-hud-muted">{title}</span>
        <HudIconButton icon="close" label="Close attack preview" kind="quiet" onClick={closeSurface} />
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-hud-body text-hud-muted">Loading enemy intel...</div>
      ) : !targetData ? (
        <div className="py-6 text-center text-hud-body text-hud-muted">No target detected.</div>
      ) : (
        <div className="space-y-1.5">
          {rollsDice && (
            <p className="text-hud-label text-hud-muted">
              Each side rolls a d20 for +1% to +20% damage; ranges run from your worst roll to your best.
            </p>
          )}
          {targetArmyData ? (
            attackerSide &&
            defenderSide && (
              <>
                {casualtyLine("Your forces", attackerSide)}
                {casualtyLine(isStructureTarget ? "Active guard" : "Enemy army", defenderSide)}
                {fightCost && <p className="text-hud-label text-hud-cue">{fightCost}</p>}
              </>
            )
          ) : (
            <HudNotice
              tone="good"
              line={
                rangedClaimBlocked
                  ? "No defending troops. Move adjacent to claim this structure."
                  : "No defending troops. You can claim without resistance."
              }
            />
          )}

          {isStructureTarget && totalGuardCount >= 1 && (
            <div className="rounded-md border border-hud-line bg-hud-well px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-hud-label text-hud-muted">Defenders</span>
                <span className="text-hud-label text-hud-cue">Post Fight</span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {defenderSlots.map((slot, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <TierChip tier={slot.tier} />
                    <ResourceIcon withTooltip={false} resource={slot.resourceId} size="sm" className="shrink-0" />
                    <span
                      className={cn("tabular-nums", "text-hud-strong", slot.eliminated && "text-hud-bad line-through")}
                    >
                      {formatTroopValue(slot.remaining)}
                    </span>
                    {slot.isActive && <span className="ml-auto text-hud-label text-hud-cue">Active</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {attackDisabled && (
            <HudNotice
              tone="bad"
              line={attackButtonLabel}
              why={
                [
                  cooldownBlocksAttack && attackerCooldownRemaining > 0
                    ? `${formatWait(attackerCooldownRemaining)} remaining`
                    : null,
                  isLowStamina ? `Current: ${attackerStaminaValue ?? "—"} / Required: ${requiredAttackStamina}` : null,
                  isLowStamina && staminaWaitSeconds !== null ? `Ready in: ${formatWait(staminaWaitSeconds)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
          )}
        </div>
      )}

      {canGarrison && (
        <div className="modal-no-drag mt-1.5 flex items-center justify-between rounded-md border border-hud-line bg-hud-well px-3 py-2">
          <label className="flex items-center gap-2 text-hud-body">
            <HudCheck checked={garrisonEnabled} label="Garrison survivors" onChange={setGarrisonEnabled} />
            Garrison survivors
          </label>
          <span className="tabular-nums text-hud-strong">{formatTroopValue(garrisonTroopCount)}</span>
        </div>
      )}

      {certainLoss && (
        <div className="modal-no-drag mt-2">
          <HudNotice
            tone="bad"
            line="Certain loss: your army is wiped out at any roll."
            why={survivalAdvice ? `${survivalAdvice[0].toUpperCase()}${survivalAdvice.slice(1)}.` : undefined}
          />
        </div>
      )}

      <HudActions className="modal-no-drag mt-2">
        <HudButton kind="secondary" onClick={handleShowDetails}>
          Details
        </HudButton>
        {/* A certain loss steps Attack back to secondary: the forecast, not the button, is the point. */}
        <HudButton
          kind={certainLoss ? "secondary" : "primary"}
          disabled={attackDisabled || !targetData || isLoading || isSubmitting}
          aria-busy={isSubmitting}
          onClick={handlePrimaryAction}
        >
          {rangedClaimBlocked ? "Move adjacent to claim" : willCaptureStructure ? "Claim" : "Attack"}
        </HudButton>
      </HudActions>
    </div>
  );
};
