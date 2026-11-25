import { env } from "@/../env";
import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { usePlayerName, usePlayerNames } from "@/hooks/use-player-profile";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudCheck, HudNotice, HudWindow } from "@/ui/design-system/kit/hud-elements";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import {
  type AttackForecast,
  CombatParameters,
  CombatSimulator,
  configManager,
  getGuildFromPlayerAddress,
  oathAttackStamina,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { ActorType, BiomeType, ContractAddress, ID } from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";

import { useEffect, useMemo, useState } from "react";
import { useLatest } from "@/hooks/use-latest";

import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { ATTACK_REFUSAL_WORDS, QUICK_ATTACK_WORDS } from "@/ui/design-system/kit/words";
import { attackerSide, defenderSide, type SideOutcome } from "../battle-outcome";
import { wholeTroops } from "../fight-forecast";
import { TargetType } from "../types";
import { ActionFooter } from "./action-footer";
import { ArmyColumn } from "./army-column";
import { BiomeEnvironmentBar } from "./biome-environment-bar";
import type { BattleLabMode } from "./battle-lab.types";
import { CombatParametersPanel } from "./combat-parameters-panel";
import { OutcomeBanner, type BattleOutcome } from "./outcome-banner";
import { OutcomeStrip } from "./outcome-strip";
import { useBattleLabLiveData } from "./use-battle-lab-live-data";
import { useBattleLabState } from "./use-battle-lab-state";
import { toast } from "@/ui/features/event-feed/notify";

interface EntityRef {
  type: ActorType;
  id: ID;
  hex: { x: number; y: number };
  alt: boolean;
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
      store,
    },
  } = useGame();

  const names = usePlayerNames();
  const closeSurface = usePopoverStore((s) => s.closeSurface);

  const attackerEntityId = selected?.id ?? (0 as ID);
  const targetHex = targetRef?.hex ?? { x: 0, y: 0 };

  const { state, dispatch, isEdited } = useBattleLabState(mode, initialBiome);
  const { snapshot, forecast, target, targetResources, isLoading } =
    // Sim mode has no target: the live read is disabled, so its placeholder hex and layer are never read.
    useBattleLabLiveData(
      mode === "live",
      attackerEntityId,
      targetHex,
      targetRef?.alt ?? false,
      state.selectedGuardSlot,
    );
  const chainSecond = useCurrentDefaultTick();
  const sides = forecast?.sides;

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
  const edited = useLatest(isEdited);
  useEffect(() => {
    if (mode === "live" && snapshot && !edited.current) {
      dispatch({ type: "INIT_LIVE", snapshot });
      setSeed((s) => s + 1);
    }
  }, [mode, snapshot, dispatch, edited]);

  const combatSimulator = useMemo(() => new CombatSimulator(parameters, configManager.getCombatRules()), [parameters]);

  const combatContext = useMemo(
    () => ({
      defenderAlt: state.defenderAlt,
      attackerIsStructureGuard: sides?.attacker.guarding ?? false,
      defenderIsStructureGuard: sides?.defender?.guarding ?? false,
    }),
    [state.defenderAlt, sides],
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

  const liveForecast = mode === "live" && !isEdited && !nonDefaultParams ? forecast : undefined;
  const prediction = useMemo(() => {
    if (!state.hasDefender) return null;
    if (liveForecast) return liveForecast.outcome === "fights" ? forecastPrediction(liveForecast) : null;
    const result = combatSimulator.simulateBattle(
      chainSecond,
      state.attacker,
      state.defender,
      state.biome,
      combatContext,
    );
    if (!result.ok) return null;
    return predictionOf(
      attackerSide(state.attacker.troopCount, result),
      defenderSide(state.defender.troopCount, result),
      result.attackerStamina,
      result.defenderStamina,
    );
  }, [combatSimulator, chainSecond, liveForecast, state, combatContext]);

  const refusal = forecast?.outcome === "refused" ? forecast.refusal : undefined;
  const actionDisabled =
    mode === "live" && (forecast === undefined || refusal !== undefined || isEdited || nonDefaultParams || loading);

  const actionLabel = (() => {
    if (isEdited || nonDefaultParams) return "Reset to act";
    if (refusal) return ATTACK_REFUSAL_WORDS[refusal];
    return forecast?.outcome === "claims" ? QUICK_ATTACK_WORDS.take : QUICK_ATTACK_WORDS.attack;
  })();

  const warning = (() => {
    if (refusal !== "insufficient-stamina" || isEdited || !sides) return undefined;
    const need = oathAttackStamina(sides.attacker.oaths, configManager.getCombatRules().stamina.stamina_attack_req);
    const held = Number(StaminaManager.getStamina(sides.attacker.troops, chainSecond).amount);
    const readyAt = StaminaManager.getAffordableAt(sides.attacker.troops, need, chainSecond);
    return staminaShortfall(held, need, readyAt === null ? undefined : Math.max(0, readyAt - chainSecond));
  })();

  const onAttack = async () => {
    if (mode !== "live" || !selected || !targetRef || !target || actionDisabled || !sides) return;
    try {
      setLoading(true);
      playUnitCommandSound("attack");

      if (sides.attacker.guardSlot !== undefined) {
        await attack_guard_vs_explorer({
          signer: account,
          structure_id: attackerEntityId,
          structure_guard_slot: sides.attacker.guardSlot,
          explorer_id: target.id,
        });
      } else if (target.targetType === TargetType.Army) {
        await attack_explorer_vs_explorer({
          signer: account,
          aggressor_id: attackerEntityId,
          defender_id: target.id,
          steal_resources: targetResources,
        });
      } else {
        await attack_explorer_vs_guard({
          signer: account,
          explorer_id: attackerEntityId,
          structure_id: target.id,
        });
      }
      closeSurface();
    } catch (error) {
      toast.failed(error, "The attack failed.");
    } finally {
      setLoading(false);
    }
  };

  // Both names are asked as the sheet draws, so they have landed by the time Share is pressed; the shared line is
  // written then, from the live name reader: never a cached string.
  usePlayerName(account.address);
  usePlayerName(target?.addressOwner ?? null);
  const shareLine = (defender: NonNullable<typeof target>) => {
    const attackerGuild = getGuildFromPlayerAddress(ContractAddress(account.address), store)?.name;
    const defenderGuild = defender.addressOwner
      ? getGuildFromPlayerAddress(ContractAddress(defender.addressOwner), store)?.name
      : undefined;
    return formatSocialText(twitterTemplates.combat, {
      attackerNameText: `${names.text(account.address)} ${attackerGuild ? `from ${attackerGuild} tribe` : ""}`,
      attackerTroopsText: `${Math.floor(state.attacker.troopCount)} ${state.attacker.tier} ${state.attacker.troopType}`,
      defenderTroopsText: `${Math.floor(state.defender.troopCount)} ${state.defender.tier} ${state.defender.troopType}`,
      defenderNameText: `${names.text(defender.addressOwner ?? 0n)} ${defenderGuild ? `from ${defenderGuild}` : ""}`,
      url: env.VITE_SOCIAL_LINK,
    });
  };
  const share =
    mode === "live" && sides !== undefined && state.hasDefender && target ? () => shareLine(target) : undefined;

  return (
    <HudWindow title="Combat" icon="military" size="workspace" onClose={closeSurface}>
      <div className="relative overflow-x-hidden">
        <CombatParametersPanel parameters={parameters} onParametersChange={setParameters} show={showParameters} />

        {mode === "live" && isLoading ? (
          <LoadingAnimation />
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
            <label className="flex items-center gap-2 text-hud-body text-hud-muted">
              <HudCheck
                checked={state.defenderAlt}
                label="Defender in ethereal layer"
                onChange={(alt) => dispatch({ type: "SET_DEFENDER_LAYER", alt })}
              />
              Defender in ethereal layer
            </label>
            <BiomeEnvironmentBar
              biome={state.defenderAlt ? BiomeType.Underground : state.biome}
              ethereal={state.defenderAlt}
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
                      side={prediction.attacker}
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
                      side={prediction.defender}
                      total={state.defender.troopCount}
                      staminaBefore={state.defender.stamina}
                      staminaAfter={prediction.newDefenderStamina}
                    />
                  ) : null
                }
              />

              <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex">
                <span className="rounded-full border border-hud-line bg-hud-well px-3 py-2 text-hud-strong text-hud-accent">
                  VS
                </span>
              </div>
            </div>

            {!state.hasDefender ? (
              <HudNotice tone="good" line={QUICK_ATTACK_WORDS.takeUnopposed} />
            ) : (
              prediction && <OutcomeBanner outcome={prediction.outcome} />
            )}

            <ActionFooter
              mode={mode}
              isEdited={isEdited || nonDefaultParams}
              onResetToLive={handleResetToLive}
              actionLabel={actionLabel}
              actionDisabled={actionDisabled}
              loading={loading}
              onAction={onAttack}
              warning={warning}
              share={share}
              cooldownEnd={state.attacker.battle_cooldown_end}
            />
          </div>
        )}
      </div>
    </HudWindow>
  );
};

type Prediction = ReturnType<typeof predictionOf>;

const predictionOf = (
  attacker: SideOutcome,
  defender: SideOutcome,
  attackerStamina: number,
  defenderStamina: number,
) => {
  const outcome: BattleOutcome = attacker.remaining === 0 ? "Defeat" : defender.remaining === 0 ? "Victory" : "Draw";
  return { attacker, defender, newAttackerStamina: attackerStamina, newDefenderStamina: defenderStamina, outcome };
};

const forecastPrediction = ({ exchange }: Extract<AttackForecast, { outcome: "fights" }>): Prediction =>
  predictionOf(
    { losses: wholeTroops(exchange.attackerLoss), remaining: wholeTroops(exchange.attacker.count) },
    { losses: wholeTroops(exchange.defenderLoss), remaining: wholeTroops(exchange.defender.count) },
    Number(exchange.attacker.stamina.amount),
    Number(exchange.defender.stamina.amount),
  );
