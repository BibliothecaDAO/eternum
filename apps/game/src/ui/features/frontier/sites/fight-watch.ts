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
  const gameId = configManager.getActiveGameId();
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: sent.armyId });
  const site = store.get("ExpeditionSite", { game_id: gameId, entity_id: sent.siteId });
  const structure = store.get("Structure", { game_id: gameId, entity_id: sent.siteId });
  const standing = site !== undefined && !site.cleared && structure !== undefined;
  const guards = standing ? getGuardsByStructure(structure, store) : [];
  if (guards === undefined) return undefined;
  return {
    army: army ? Number(army.troops.count / PRECISION) : 0,
    guard: Number(guards.reduce((sum, guard) => sum + guard.troops.count, 0n) / PRECISION),
  };
};
