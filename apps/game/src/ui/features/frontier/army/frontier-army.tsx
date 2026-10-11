import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { scoutingBonusBps, scoutingIncrementBps, scoutingKindsOf, type ScoutingKind } from "@bibliothecadao/eternum";
import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import {
  affordableUpgrades,
  type ArmyProgressFacts,
  type Attribute,
  ATTRIBUTE_LOOK,
  type ProgressionRulesFacts,
} from "../attributes/attributes";
import { useDockArmies } from "../hud/dock-armies";
import { ArmyRefill } from "./army-refill";
import { type AttributeKey, ArmySheet } from "./army-sheet";

const PROGRESS_MODELS = ["ArmyProgress", "ArmyProgressionRules"] as const;

const KEYS: Record<Attribute, AttributeKey> = {
  Battle: "battle",
  Logistics: "logistics",
  Scouting: "scouting",
  Homecoming: "homecoming",
};
const ATTRIBUTE_OF: Record<AttributeKey, Attribute> = {
  battle: "Battle",
  logistics: "Logistics",
  scouting: "Scouting",
  homecoming: "Homecoming",
};
const KIND_KEYS: Record<ScoutingKind, ScoutKey> = { Camp: "camp", Rift: "rift", Stragglers: "stragglers" };
const KIND_OF: Record<ScoutKey, ScoutingKind> = { camp: "Camp", rift: "Rift", stragglers: "Stragglers" };
type ScoutKey = "camp" | "rift" | "stragglers";

/**
 * The selected army over the game's facts: its XP, stamina and four attribute tiers, each next tier's XP price, what a
 * tier gives, Scouting's kinds and their find rates, and Upgrade (buy_tier), which refills TIER_STAMINA_REFILL. None
 * while the army or its progress is unknown.
 */
export const FrontierArmy = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup, account } = useGame();
  useNativeRevision(PROGRESS_MODELS);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const army = useDockArmies(realm).find(({ explorerId }) => explorerId === selectedId);
  const [chosen, setChosen] = useState<AttributeKey | null>(null);
  const [kind, setKind] = useState<ScoutKey>("camp");
  const [sending, setSending] = useState(false);
  const progress = army && setup.store.get("ArmyProgress", { game_id: realm.game_id, explorer_id: army.explorerId });
  const rules = setup.store.get("ArmyProgressionRules", { game_id: realm.game_id });
  if (!army || !progress || !rules || !army.stamina) return null;
  const shown = chosen ?? firstAffordable(progress, rules);

  const upgrade = async () => {
    if (!account.account) return;
    setSending(true);
    try {
      await setup.systemCalls.buy_tier({
        signer: account.account,
        explorerId: army.explorerId,
        attribute: ATTRIBUTE_OF[shown],
        scoutingKind: shown === "scouting" ? KIND_OF[kind] : undefined,
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The Upgrade could not be sent."));
    } finally {
      setSending(false);
    }
  };

  return (
    <ArmySheet
      name={army.label}
      art={army.art}
      troops={army.troops}
      xp={progress.xp}
      stamina={{ ...army.stamina, secondsToFull: army.secondsToFull }}
      refill={<ArmyRefill army={army} realm={realm} />}
      attributes={attributeStates(progress)}
      tierPrices={{ 2: rules.uncommon_xp, 3: rules.rare_xp, 4: rules.epic_xp, 5: rules.legendary_xp }}
      effects={EFFECTS}
      refillOnBuy={nativeRuleConstants.TIER_STAMINA_REFILL}
      chosen={shown}
      onChoose={setChosen}
      kindRates={kindRates(progress)}
      kind={kind}
      onKind={setKind}
      sending={sending}
      onUpgrade={() => void upgrade()}
      onClose={onClose}
    />
  );
};

/** The attribute the sheet opens on: the first the army can buy now, else Battle. */
const firstAffordable = (progress: ArmyProgressFacts, rules: ProgressionRulesFacts): AttributeKey => {
  const [first] = affordableUpgrades(progress, rules);
  return first ? KEYS[first] : "battle";
};

/** Each attribute's tier, and Scouting's kind at each tier above common. */
const attributeStates = (progress: ArmyProgressFacts) => ({
  battle: { tier: progress.battle as Tier },
  logistics: { tier: progress.logistics as Tier },
  scouting: {
    tier: progress.scouting as Tier,
    kinds: scoutingKindsOf(progress.scouting, progress.scouting_kinds).map((kind) => KIND_KEYS[kind]),
  },
  homecoming: { tier: progress.homecoming as Tier },
});

/** What each tier of an attribute gives, common to legendary, as the contract's tables apply it. */
const tierEffects = (attribute: Attribute): readonly [string, string, string, string, string] => {
  const { atTier, unit } = ATTRIBUTE_LOOK[attribute];
  const effect = (tier: number) => `+${atTier(tier)}${unit}`;
  return [effect(1), effect(2), effect(3), effect(4), effect(5)];
};

const EFFECTS: Record<AttributeKey, readonly [string, string, string, string, string]> = {
  battle: tierEffects("Battle"),
  logistics: tierEffects("Logistics"),
  scouting: tierEffects("Scouting"),
  homecoming: tierEffects("Homecoming"),
};

/** Each kind's find rate bonus now, and with the next Scouting tier on it. */
const kindRates = (progress: ArmyProgressFacts): Record<ScoutKey, readonly [string, string]> => {
  const bonus = scoutingBonusBps(progress.scouting, progress.scouting_kinds);
  const next = progress.scouting < 5 ? scoutingIncrementBps(progress.scouting + 1) : 0;
  const rate = (bps: number) => `+${bps / 100}%`;
  return {
    camp: [rate(bonus.Camp), rate(bonus.Camp + next)],
    rift: [rate(bonus.Rift), rate(bonus.Rift + next)],
    stragglers: [rate(bonus.Stragglers), rate(bonus.Stragglers + next)],
  };
};
