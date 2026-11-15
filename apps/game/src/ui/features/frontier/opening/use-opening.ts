import { useGame } from "@/hooks/context/game-context";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { type ExpeditionRules, DAILY_QUEST_MODELS, getBuildingQuantity, readDailyQuest } from "@bibliothecadao/eternum";
import { isDeepTile, safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useEffect } from "react";

import type { OpeningRules } from "@/ui/design-system/kit/words";
import { FIRST_BUILD } from "../build/first-build";
import { useDockArmies } from "../hud/dock-armies";
import { useRealmStores } from "../realm-stores";
import { type Opened, type OpeningMoment } from "./opening";
import { type OpeningHeld, nextLine, openedMoments, reachedOnState } from "./opening-state";
import { loadOpening, reachMoments, seeLine, useOpeningStore } from "./opening-store";

/**
 * What the HUD shows and the one line to say now, for the player's own realm: the moments the realm's state reaches, and
 * those the account reached before (kept on its identity account). Show everything turns every part on. A moment reached
 * is recorded at once, so the part stays when the state that reached it passes.
 */
export function useOpening(
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
): { opened: Opened; line: { moment: OpeningMoment; rules: OpeningRules } | null; gotIt: () => void } {
  const owner = notificationOwnerOf(useIdentitySession().session);
  useEffect(() => {
    void loadOpening(owner);
  }, [owner]);
  const showEverything = useWorldAppearanceStore((state) => state.showEverything);
  const kept = useOpeningStore((state) => state.reached);
  const seen = useOpeningStore((state) => state.seen);
  const onState = reachedOnState(useOpeningHeld(rules, realm));
  const key = onState.join();
  useEffect(() => {
    if (realm) void reachMoments(key.split(","));
  }, [realm, key]);
  const opened = openedMoments(kept, onState);
  const moment = realm ? nextLine(opened, seen) : null;
  const lineRules = useOpeningRules(rules, realm);
  return {
    opened: showEverything || !realm ? "all" : opened,
    line: showEverything || !moment || !lineRules ? null : { moment, rules: lineRules },
    gotIt: () => moment && void seeLine(moment),
  };
}

/** The rules a line names, read from the game's own rows; none while a row is not read, so no line says a made-up figure. */
function useOpeningRules(rules: ExpeditionRules, realm: NativeRows["Structure"] | null): OpeningRules | null {
  const { setup } = useGame();
  const troops = useRealmStores(realm, rules)?.troops.perHour;
  if (!realm || troops === undefined) return null;
  const barracks = getBuildingQuantity(safeInteger(realm.entity_id), FIRST_BUILD, setup.store);
  const slice = setup.store.get("SliceRules", { game_id: realm.game_id });
  const deep = setup.store.get("DeepRules", { game_id: realm.game_id });
  if (!slice || !deep) return null;
  return {
    knightsAnHour: troops / Math.max(1, barracks),
    deepTick: {
      tickSeconds: Number(slice.tick_config.armies_tick_in_seconds),
      lossPerTick: Number(deep.loss_per_tick) / RESOURCE_PRECISION,
    },
  };
}

/** What the realm holds or has done now, from the game's facts, for each moment its state can reach. */
function useOpeningHeld(rules: ExpeditionRules, realm: NativeRows["Structure"] | null): OpeningHeld {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const armies = useDockArmies(realm);
  const essence = useRealmStores(realm, rules)?.essence.amount;
  if (!realm) return {};
  const home = safeInteger(realm.entity_id);
  const { spacing } = setup.store.require("SettlementRules", { game_id: realm.game_id });
  return {
    barracks: getBuildingQuantity(home, FIRST_BUILD, setup.store) > 0,
    fight: armies.some((army) => (army.xp ?? 0) > 0),
    essence: (essence ?? 0) > 0,
    deep: armies.some((army) => {
      const tile = setup.store.entityOccupancy(realm.game_id, army.explorerId);
      return tile !== undefined && isDeepTile(spacing, tile);
    }),
    bane: readDailyQuest(setup.store, realm.game_id, home, now)?.reading.known?.bane !== undefined,
  };
}
