import { env } from "@/../env";
import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { createAttackProvisionalIntent, startWorldmapProvisionalFx } from "@/three/scenes/worldmap-provisional-fx";
import {
  type Army,
  CombatParameters,
  CombatSimulator,
  configManager,
  getAddressName,
  getGuildFromPlayerAddress,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { trackProvisionalTransaction, type ProvisionalIntent } from "@bibliothecadao/eternum/game-sync";
import { ActorType, BiomeType, ContractAddress, getHexDistance, ID } from "@bibliothecadao/types";
import Swords from "lucide-react/dist/esm/icons/swords";
import { useEffect, useMemo, useState } from "react";

import {
  buildAttackStaminaRequirementLabel,
  buildAttackStaminaWarning,
  resolveAttackStaminaState,
} from "../attack-stamina-state";
import { RaidContainer } from "../raid-container";
import { TargetType } from "../types";
import { ActionFooter } from "./action-footer";
import { ArmyColumn } from "./army-column";
import { BiomeEnvironmentBar } from "./biome-environment-bar";
import type { BattleLabMode, WorkingArmy } from "./battle-lab.types";
import { CombatParametersPanel } from "./combat-parameters-panel";
import { OutcomeBanner, type BattleOutcome } from "./outcome-banner";
import { OutcomeStrip } from "./outcome-strip";
import { useBattleLabLiveData } from "./use-battle-lab-live-data";
import { useBattleLabState } from "./use-battle-lab-state";

interface EntityRef {
  type: ActorType;
  id: ID;
  hex: { x: number; y: number };
}

interface BattleLabProps {
  mode: BattleLabMode;
  /** live mode: attacker entity */
  selected?: EntityRef;
  /** live mode: target entity */
  target?: EntityRef;
  /** sim mode: starting biome */
  initialBiome?: BiomeType;
}

const toArmy = (army: WorkingArmy): Army => ({
  stamina: army.stamina,
  troopCount: army.troopCount,
  troopType: army.troopType,
  tier: army.tier,
  battle_cooldown_end: army.battle_cooldown_end,
});

const shortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

/** Stable key for a CombatParameters object (bigint-safe, unlike raw JSON.stringify). */
const serializeParams = (params: CombatParameters) =>
  JSON.stringify(params, (_key, value) => (typeof value === "bigint" ? value.toString() : value));

export const BattleLab = ({
  mode,
  selected,
  target: targetRef,
  initialBiome = BiomeType.Grassland,
}: BattleLabProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { attack_explorer_vs_explorer, attack_explorer_vs_guard, attack_guard_vs_explorer },
      components,
    },
  } = useDojo();

  const gameMode = useGameModeConfig();
  const accountName = useAccountStore((s) => s.accountName);
  const selectedHex = useUIStore((s) => s.selectedHex);
  const toggleModal = useUIStore((s) => s.toggleModal);
  const updateSelectedEntityId = useUIStore((s) => s.updateEntityActionSelectedEntityId);

  const attackerEntityId = selected?.id ?? (0 as ID);
  const targetHex = targetRef?.hex ?? { x: 0, y: 0 };

  const { state, dispatch, isEdited } = useBattleLabState(mode, initialBiome);
  const { snapshot, target, targetResources, attackerRelicEffects, targetRelicEffects, isLoading } =
    useBattleLabLiveData(mode === "live", attackerEntityId, targetHex);

  const [parameters, setParameters] = useState<CombatParameters>(() => configManager.getCombatConfig());
  const [showParameters, setShowParameters] = useState(false);
  const [loading, setLoading] = useState(false);
  // Bumped to force the select inputs (which seed from defaultValue once) to
  // remount when the live baseline changes (initial seed, guard switch, reset).
  const [seed, setSeed] = useState(0);

  // Ctrl+Shift+S → advanced parameters
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") setShowParameters((prev) => !prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Seed working values from chain once data resolves; never clobber a what-if.
  useEffect(() => {
    if (mode === "live" && snapshot && !isEdited) {
      dispatch({ type: "INIT_LIVE", snapshot });
      setSeed((s) => s + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, snapshot]);

  const combatSimulator = useMemo(() => new CombatSimulator(parameters), [parameters]);

  // Combat v3 context: range is derived from the live hex distance (crossbowmen poke at range 2),
  // and structure-guard flags drive the ranged structure reduction / Knight modifiers. In sim mode
  // there is no map distance, so it falls back to adjacent (range 1).
  const liveAttackDistance = useMemo(() => {
    if (mode !== "live" || !selectedHex || !target) return 1;
    return getHexDistance(selectedHex, { col: target.hex.x, row: target.hex.y });
  }, [mode, selectedHex, target]);

  const combatContext = useMemo(
    () => ({
      attackDistance: liveAttackDistance,
      attackerIsStructureGuard: snapshot?.attackerType === "structure",
      defenderIsStructureGuard: target?.targetType === TargetType.Structure,
    }),
    [liveAttackDistance, snapshot?.attackerType, target?.targetType],
  );
  // CombatParameters holds bigint fields, so stringify with a bigint-safe replacer.
  const defaultParamsKey = useMemo(() => serializeParams(configManager.getCombatConfig()), []);
  const nonDefaultParams = useMemo(
    () => serializeParams(parameters) !== defaultParamsKey,
    [parameters, defaultParamsKey],
  );

  const handleSelectGuard = (slot: number) => {
    const guard = snapshot?.guards.find((g) => g.slot === slot);
    if (!guard) return;
    dispatch({ type: "SELECT_GUARD_SLOT", slot, army: guard.army });
    setSeed((s) => s + 1);
  };

  const handleResetToLive = () => {
    dispatch({ type: "RESET_TO_LIVE" });
    setParameters(configManager.getCombatConfig());
    setSeed((s) => s + 1);
  };

  // ----- Prediction (single path for live + sim) -----
  const prediction = useMemo(() => {
    if (!state.hasDefender) return null;
    const now = Math.floor(Date.now() / 1000);
    const result = combatSimulator.simulateBattleWithParams(
      now,
      toArmy(state.attacker),
      toArmy(state.defender),
      state.biome,
      state.attacker.relics,
      state.defender.relics,
      combatContext,
    );
    const attackerLosses = Math.min(state.attacker.troopCount, result.defenderDamage);
    const defenderLosses = Math.min(state.defender.troopCount, result.attackerDamage);
    const attackerRemaining = Math.max(0, state.attacker.troopCount - attackerLosses);
    const defenderRemaining = Math.max(0, state.defender.troopCount - defenderLosses);
    const outcome: BattleOutcome = attackerRemaining <= 0 ? "Defeat" : defenderRemaining <= 0 ? "Victory" : "Draw";
    return {
      attackerLosses,
      defenderLosses,
      attackerRemaining,
      defenderRemaining,
      newAttackerStamina: combatSimulator.calculateNewStaminaAttacker(
        state.attacker.stamina,
        result.attackerRefundMultiplier,
        combatContext,
      ),
      newDefenderStamina: combatSimulator.calculateNewStaminaDefender(
        state.defender.stamina,
        result.defenderRefundMultiplier,
        combatContext,
      ),
      outcome,
    };
  }, [combatSimulator, state.attacker, state.defender, state.biome, state.hasDefender, combatContext]);

  // ----- Live action gating -----
  const hasAttacker =
    mode === "sim"
      ? true
      : snapshot
        ? snapshot.attackerType === "structure"
          ? snapshot.guards.length > 0
          : snapshot.armyAttacker !== null
        : false;

  const combatConfig = useMemo(() => configManager.getCombatConfig(), []);
  const attackStaminaState = useMemo(
    () =>
      resolveAttackStaminaState({
        attackerStamina: state.attacker.stamina,
        hasAttackerTroops: hasAttacker,
        hasDefenders: state.hasDefender,
        requiredStamina: Number(combatConfig.stamina_attack_req),
      }),
    [state.attacker.stamina, hasAttacker, state.hasDefender, combatConfig],
  );

  const isAttackerOnCooldown = state.attacker.battle_cooldown_end > Math.floor(Date.now() / 1000);

  // A ranged poke can clear guards but never claims — the structure must be taken from an adjacent hex.
  const rangedClaimBlocked =
    mode === "live" && !state.hasDefender && combatContext.defenderIsStructureGuard && liveAttackDistance > 1;

  const actionDisabled =
    mode === "live" &&
    (!hasAttacker ||
      isEdited ||
      nonDefaultParams ||
      rangedClaimBlocked ||
      isAttackerOnCooldown ||
      attackStaminaState.isBlocked ||
      loading);

  const actionLabel = (() => {
    if (rangedClaimBlocked) return "Move Adjacent to Claim";
    if (isAttackerOnCooldown) return "On Battle Cooldown";
    if (isEdited || nonDefaultParams) return "Reset to act";
    if (attackStaminaState.isBlocked) return buildAttackStaminaRequirementLabel(attackStaminaState);
    if (!hasAttacker) return "No Troops Present";
    return attackStaminaState.actionLabel;
  })();

  const warning = attackStaminaState.isBlocked && !isEdited ? buildAttackStaminaWarning(attackStaminaState) : undefined;

  // Raid is available for an explorer attacker vs a structure target.
  const isExplorerAttacker = mode === "live" && snapshot?.attackerType === "army";
  const isStructureTarget = target?.targetType === TargetType.Structure;
  const showRaidToggle = Boolean(isExplorerAttacker && isStructureTarget && gameMode.ui.showAttackTypeSelector);
  const raidActive = state.attackType === "raid" && showRaidToggle;

  const onAttack = async () => {
    if (mode !== "live" || !selected || !targetRef || !selectedHex || !target || actionDisabled || !snapshot) return;
    let intent: ProvisionalIntent | null = null;
    try {
      setLoading(true);

      intent = createAttackProvisionalIntent(attackerEntityId, selected.type);
      startWorldmapProvisionalFx(
        {
          kind: "attack",
          attackerId: attackerEntityId,
          attackerHex: { col: selectedHex.col, row: selectedHex.row },
          targetId: target.id,
          targetHex: { col: target.hex.x, row: target.hex.y },
          troopTier: state.attacker.tier,
          troopType: state.attacker.troopType,
        },
        intent,
      );
      playUnitCommandSound("attack");

      let result: unknown;
      if (snapshot.attackerType === "structure") {
        if (state.selectedGuardSlot === null) throw new Error("No structure guard is selected");
        result = await attack_guard_vs_explorer({
          signer: account,
          structure_id: attackerEntityId,
          structure_guard_slot: state.selectedGuardSlot,
          explorer_id: target.id || 0,
        });
      } else if (target.targetType === TargetType.Army) {
        result = await attack_explorer_vs_explorer({
          signer: account,
          aggressor_id: attackerEntityId,
          defender_id: target.id || 0,
          steal_resources: targetResources,
        });
      } else {
        result = await attack_explorer_vs_guard({
          signer: account,
          explorer_id: attackerEntityId,
          structure_id: target.id || 0,
        });
      }
      trackProvisionalTransaction(intent, account, result);

      updateSelectedEntityId(null);
      toggleModal(null);
    } catch (error) {
      intent?.fail();
      console.error("Attack failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const tweet = useMemo(() => {
    if (mode !== "live" || !hasAttacker || !state.hasDefender || !target) return undefined;
    const attackerGuild = getGuildFromPlayerAddress(ContractAddress(account.address), components)?.name;
    const defenderGuild = target.addressOwner
      ? getGuildFromPlayerAddress(ContractAddress(target.addressOwner), components)?.name
      : undefined;
    return formatSocialText(twitterTemplates.combat, {
      attackerNameText: `${accountName || shortAddress(account.address)} ${attackerGuild ? `from ${attackerGuild} tribe` : ""}`,
      attackerTroopsText: `${Math.floor(state.attacker.troopCount)} ${state.attacker.tier} ${state.attacker.troopType}`,
      defenderTroopsText: `${Math.floor(state.defender.troopCount)} ${state.defender.tier} ${state.defender.troopType}`,
      defenderNameText: `${target.addressOwner ? getAddressName(target.addressOwner, components) : "@daydreamsagents"} ${defenderGuild ? `from ${defenderGuild}` : ""}`,
      url: env.VITE_SOCIAL_LINK,
    });
  }, [
    mode,
    hasAttacker,
    state.hasDefender,
    target,
    account.address,
    accountName,
    components,
    state.attacker,
    state.defender,
  ]);

  return (
    <CenteredModalShell
      title="Combat"
      icon={Swords}
      onClose={() => toggleModal(null)}
      size="xl"
      bodyClassName="relative overflow-y-auto overflow-x-hidden"
    >
      <CombatParametersPanel parameters={parameters} onParametersChange={setParameters} show={showParameters} />

      {mode === "live" && isLoading ? (
        <LoadingAnimation />
      ) : raidActive ? (
        <RaidContainer
          attackerEntityId={attackerEntityId}
          target={target!}
          targetResources={targetResources}
          attackerActiveRelicEffects={attackerRelicEffects}
          targetActiveRelicEffects={targetRelicEffects}
        />
      ) : (
        <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
          <BiomeEnvironmentBar
            combatSimulator={combatSimulator}
            biome={state.biome}
            onSelect={(biome) => dispatch({ type: "SET_BIOME", biome })}
          />

          <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ArmyColumn
              key={`attacker-${seed}`}
              label="Attacker"
              side="attacker"
              army={state.attacker}
              onChange={(patch) => dispatch({ type: "PATCH_ATTACKER", patch })}
              guards={snapshot?.attackerType === "structure" ? snapshot.guards : undefined}
              selectedGuardSlot={state.selectedGuardSlot}
              onSelectGuard={handleSelectGuard}
              footer={
                prediction && (
                  <OutcomeStrip
                    losses={prediction.attackerLosses}
                    lossesPercent={
                      state.attacker.troopCount > 0 ? (prediction.attackerLosses / state.attacker.troopCount) * 100 : 0
                    }
                    remaining={prediction.attackerRemaining}
                    total={state.attacker.troopCount}
                    staminaBefore={state.attacker.stamina}
                    staminaAfter={prediction.newAttackerStamina}
                  />
                )
              }
            />

            <ArmyColumn
              key={`defender-${seed}`}
              label="Defender"
              side="defender"
              army={state.defender}
              onChange={(patch) => dispatch({ type: "PATCH_DEFENDER", patch })}
              footer={
                state.hasDefender && prediction ? (
                  <OutcomeStrip
                    losses={prediction.defenderLosses}
                    lossesPercent={
                      state.defender.troopCount > 0 ? (prediction.defenderLosses / state.defender.troopCount) * 100 : 0
                    }
                    remaining={prediction.defenderRemaining}
                    total={state.defender.troopCount}
                    staminaBefore={state.defender.stamina}
                    staminaAfter={prediction.newDefenderStamina}
                  />
                ) : null
              }
            />

            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex">
              <span className="rounded-full border border-gold/30 bg-black/70 px-3 py-2 text-sm font-bold text-gold">
                VS
              </span>
            </div>
          </div>

          {!state.hasDefender ? (
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-900/20 px-4 py-3 text-center text-sm font-semibold text-emerald-200">
              {rangedClaimBlocked
                ? "No defending troops — move adjacent to claim. Ranged attacks clear guards but cannot claim structures."
                : "No defending troops — this target can be claimed without a battle."}
            </div>
          ) : (
            prediction && <OutcomeBanner outcome={prediction.outcome} />
          )}

          <ActionFooter
            mode={mode}
            attackType={state.attackType}
            showRaidToggle={showRaidToggle}
            onSetAttackType={(attackType) => dispatch({ type: "SET_ATTACK_TYPE", attackType })}
            isEdited={isEdited || nonDefaultParams}
            onResetToLive={handleResetToLive}
            actionLabel={actionLabel}
            actionDisabled={actionDisabled}
            loading={loading}
            onAction={onAttack}
            warning={warning}
            tweet={tweet}
            cooldownEnd={state.attacker.battle_cooldown_end}
          />
        </div>
      )}
    </CenteredModalShell>
  );
};
