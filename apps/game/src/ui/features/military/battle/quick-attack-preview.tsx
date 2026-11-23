import { type MouseEvent, useEffect, useMemo, useState } from "react";

import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { HudActions, HudButton, HudCheck, HudIconButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import {
  ATTACK_FORECAST_MODELS,
  configManager,
  forecastAttack,
  getTroopResourceId,
  oathAttackStamina,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";

import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { ATTACK_REFUSAL_WORDS } from "@/ui/design-system/kit/words";
import { CombatModal } from "./combat-modal";
import { troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { FightSide } from "@/ui/features/frontier/sites/fight-side";
import { combatTitle, describeFightCost, wholeTroops } from "./fight-forecast";
import { useAttackTargetData } from "./hooks/use-attack-target";
import { AttackTarget, TargetType } from "./types";

import {
  getDirectionBetweenAdjacentHexes,
  RESOURCE_PRECISION,
  type ActorType,
  type ID,
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
  const facts = useNativeFacts([...ATTACK_FORECAST_MODELS, "ResourceBalance", "ResourceProduction", "ResourceWeight"]);

  const accountName = usePlayerDisplayName(account?.address);
  // The attacker's own tile, never the map's selected one: a selected army can show another tile's card.
  const attackerHex = useMemo(() => ({ col: attacker.hex.x, row: attacker.hex.y }), [attacker.hex.x, attacker.hex.y]);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Opt-in toggle: when on, the Claim action also garrisons the surviving troops. Off by default.
  const [garrisonEnabled, setGarrisonEnabled] = useState(false);

  const executionSecond = useCurrentDefaultTick();

  const { target: targetData, targetResources, isLoading } = useAttackTargetData(attacker.id, target.hex, target.alt);
  const targetOwnerName = usePlayerDisplayName(targetData ? (targetData.addressOwner ?? 0n) : null);

  const ethereal = target.alt;

  const attackerType = useMemo(() => {
    const structure = facts.store.get("Structure", {
      game_id: configManager.getActiveGameId(),
      entity_id: attacker.id,
    });
    return structure ? AttackerType.Structure : AttackerType.Army;
  }, [attacker.id, facts]);

  const forecast = useMemo(() => {
    if (!targetData) return undefined;
    const game_id = configManager.getActiveGameId();
    return forecastAttack(
      facts.store,
      { game_id, entity_id: attacker.id },
      { game_id, entity_id: targetData.id },
      executionSecond,
    );
  }, [facts, attacker.id, targetData, executionSecond]);

  const sides = forecast?.sides;
  const fought = forecast?.outcome === "fights" ? forecast : undefined;
  const refusal = forecast?.outcome === "refused" ? forecast.refusal : undefined;
  const attackerTroops = sides?.attacker.troops;
  const defenderTroops = sides?.defender?.troops;
  const queuedTargetGuards = useMemo(() => sides?.queued ?? [], [sides]);
  const isStructureTarget = targetData?.targetType === TargetType.Structure;
  const attackerIsArmy = attackerType === AttackerType.Army;
  const certainLoss = fought?.certainLoss ?? false;

  const attackerTroopsTotal = attackerTroops ? wholeTroops(attackerTroops.count) : 0;
  const defenderTroopsTotal = defenderTroops ? wholeTroops(defenderTroops.count) : 0;
  const attackerKept = fought ? wholeTroops(fought.exchange.attacker.count) : undefined;
  const defenderKept = fought ? wholeTroops(fought.exchange.defender.count) : undefined;

  const defenderSlots = useMemo(() => {
    if (!isStructureTarget || !defenderTroops) return [];
    return [defenderTroops, ...queuedTargetGuards.map((guard) => guard.troops)].map((snapshot, index) => {
      const isActive = index === 0;
      const remaining = isActive && defenderKept !== undefined ? defenderKept : wholeTroops(snapshot.count);
      const resourceId = getTroopResourceId(snapshot.category, snapshot.tier);
      return { tier: snapshot.tier, resourceId, remaining, isActive, eliminated: remaining <= 0 };
    });
  }, [isStructureTarget, defenderTroops, queuedTargetGuards, defenderKept]);

  const clearsAllDefenders = forecast?.outcome === "claims" || (defenderKept === 0 && queuedTargetGuards.length === 0);
  const willCaptureStructure =
    attackerIsArmy &&
    isStructureTarget &&
    clearsAllDefenders &&
    (forecast?.outcome === "claims" || (attackerKept ?? 0) > 0);

  const garrisonGuardSlot = useMemo(() => {
    if (!willCaptureStructure || !targetData) return null;
    const [firstSlot] = targetData.guardSlots ?? [];
    return firstSlot ?? null;
  }, [willCaptureStructure, targetData]);

  const garrisonTroopCount = useMemo(() => {
    const structureLevel = targetData?.structureLevel;
    if (!willCaptureStructure || !attackerTroops || structureLevel == null) return 0;
    const survivors = attackerKept ?? attackerTroopsTotal;
    const buffered = Math.floor(survivors * 0.99);
    const maxArmySize = configManager.getMaxArmySize(structureLevel, attackerTroops.tier);
    return Math.max(0, Math.min(buffered, maxArmySize));
  }, [willCaptureStructure, attackerTroops, attackerKept, attackerTroopsTotal, targetData]);

  const canGarrison = !ethereal && willCaptureStructure && garrisonGuardSlot !== null && garrisonTroopCount >= 1;

  useEffect(() => {
    if (!canGarrison) {
      setGarrisonEnabled(false);
    }
  }, [canGarrison]);

  const attackDisabled = forecast === undefined || refusal !== undefined;
  const refusalLine = (() => {
    if (refusal === undefined) return null;
    if (refusal === "insufficient-stamina" && sides) {
      const need = oathAttackStamina(sides.attacker.oaths, configManager.getCombatRules().stamina.stamina_attack_req);
      const held = Number(StaminaManager.getStamina(sides.attacker.troops, executionSecond).amount);
      const readyAt = StaminaManager.getAffordableAt(sides.attacker.troops, need, executionSecond);
      return staminaShortfall(held, need, readyAt == null ? undefined : Math.max(0, readyAt - executionSecond));
    }
    if (refusal === "cooldown" && attackerTroops)
      return `${ATTACK_REFUSAL_WORDS.cooldown} · ${formatWait(Math.max(0, attackerTroops.battle_cooldown_end - executionSecond))}`;
    return ATTACK_REFUSAL_WORDS[refusal];
  })();

  // Who survives and what each side loses are the casualty lines below; the title only names the sides.
  const title = combatTitle(accountName, targetOwnerName);
  const fightCost = fought ? describeFightCost(fought.fight) : null;

  // Shared submit pipeline: guards, pending worldmap FX, sound, and teardown are identical across
  // every attack variant — only the system call differs, so callers just provide that call.
  const runWorldmapAttack = async (
    performCall: (ctx: { direction: number | null; resolvedTarget: AttackTarget }) => Promise<unknown>,
  ) => {
    if (!targetData || attackDisabled) return;
    // Range-2 pokes are not adjacent, so direction is null for them; only the adjacency-only
    // garrison multicall requires it, and it guards for null itself.
    const direction = getDirectionBetweenAdjacentHexes(attackerHex, { col: target.hex.x, row: target.hex.y });
    const resolvedTarget = targetData;

    try {
      setIsSubmitting(true);

      playUnitCommandSound("attack");
      await performCall({ direction, resolvedTarget });

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
        const guardSlot = sides?.attacker.guardSlot;
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
          {defenderTroops ? (
            <>
              {/* Both sides in every state: without a forecast (short of stamina, on cooldown, out of range) each keeps
                  a dash, and the state is the line under them with Attack held. */}
              <div className="flex gap-2">
                <FightSide
                  label="Your forces"
                  mark={attackerTroops && <Icon name={troopMeaning(attackerTroops)} size={64} className="size-full" />}
                  before={attackerTroops ? attackerTroopsTotal : undefined}
                  kept={attackerKept}
                  side="ours"
                />
                <FightSide
                  label={isStructureTarget ? "Active guard" : "Enemy army"}
                  mark={<Icon name={troopMeaning(defenderTroops)} size={64} className="size-full" />}
                  before={defenderTroopsTotal}
                  kept={defenderKept}
                  side="theirs"
                />
              </div>
              {fightCost && <p className="text-hud-label text-hud-cue">{fightCost}</p>}
            </>
          ) : (
            forecast?.outcome === "claims" && <HudNotice tone="good" line="No defenders: claim it" />
          )}

          {defenderSlots.length >= 1 && (
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

          {refusalLine && <HudNotice tone="bad" line={refusalLine} />}
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
          <HudNotice tone="bad" line="Certain loss at any roll" />
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
          {willCaptureStructure ? "Claim" : "Attack"}
        </HudButton>
      </HudActions>
    </div>
  );
};
