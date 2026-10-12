import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager, getGuardsByStructure } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useEffect } from "react";

import { fightEnded, type FightSent, type FightSides, readFightResult, useFightSent } from "./fight-result";

const FIGHT_MODELS = ["ExplorerTroops", "Guard", "ExpeditionSite", "Structure"] as const;
const PRECISION = BigInt(RESOURCE_PRECISION);

/**
 * Ends the player's attack in flight once the facts carry what it did, so its result shows until closed. A ruin's
 * clear ends on its chest opening, which is that fight's result.
 */
export const useFightWatch = (): void => {
  const { setup } = useGame();
  const sent = useFightSent();
  const revision = useNativeRevision(FIGHT_MODELS);
  useEffect(() => {
    const now = sent && readFightSides(setup.store, sent);
    const result = sent && now && readFightResult(sent, now);
    if (!result) return;
    fightEnded(result.verdict === "victory" && result.site === "Ruin" ? null : result);
  }, [sent, revision, setup.store]);
};

/** Whole troops each side holds now: none for an army that is gone or a site that is cleared; unknown guards wait. */
const readFightSides = (store: NativeFactStore, sent: FightSent): FightSides | undefined => {
  const defenders = sent.site === "Army" ? armyTroops(store, sent.targetId) : guardTroops(store, sent.targetId);
  return defenders === undefined ? undefined : { army: armyTroops(store, sent.armyId), guard: defenders };
};

const armyTroops = (store: NativeFactStore, explorerId: number): number => {
  const army = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
  return army ? Number(army.troops.count / PRECISION) : 0;
};

const guardTroops = (store: NativeFactStore, siteId: number): number | undefined => {
  const key = { game_id: configManager.getActiveGameId(), entity_id: siteId };
  const site = store.get("ExpeditionSite", key);
  const structure = store.get("Structure", key);
  if (site === undefined || site.cleared || structure === undefined) return 0;
  const guards = getGuardsByStructure(structure, store);
  return guards && Number(guards.reduce((sum, guard) => sum + guard.troops.count, 0n) / PRECISION);
};
