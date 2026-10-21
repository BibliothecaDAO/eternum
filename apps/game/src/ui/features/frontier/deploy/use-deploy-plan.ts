import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useMemo } from "react";

import { useExpeditionRules } from "../frontier-home";
import { readDeployPlan } from "./deploy-plan";

// Research sets what a troop costs and the Logistics a new army starts at; ended armies send Homecoming's troops back.
const DEPLOY_MODELS = [
  "ArmyProgress",
  "ArmySlot",
  "ExplorerTroops",
  "RealmKnowledge",
  "ResourceBalance",
  "ResourceProduction",
  "Structure",
  "TileOccupancy",
] as const;

/**
 * The realm's deploy today, as the Deploy sheet and the dock's open slots both read it: one reading of the open slots
 * and the bar each starts an army on. Undefined while any of it is unknown.
 */
export const useDeployPlan = (realm: NativeRows["Structure"] | null | undefined) => {
  const defaultTick = useCurrentDefaultTick();
  const facts = useNativeFacts(DEPLOY_MODELS);
  const rules = useExpeditionRules();
  const now = useNowSeconds();
  return useMemo(
    () => (realm && rules ? readDeployPlan(facts.store, realm, rules, { now, defaultTick }) : undefined),
    [defaultTick, now, realm, facts, rules],
  );
};
