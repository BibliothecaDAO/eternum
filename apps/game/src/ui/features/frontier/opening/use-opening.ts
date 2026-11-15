import { useGame } from "@/hooks/context/game-context";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { type ExpeditionRules, DAILY_QUEST_MODELS, getBuildingQuantity, readDailyQuest } from "@bibliothecadao/eternum";
import {
  isDeepTile,
  RACE_MODELS,
  readRaceBoard,
  safeInteger,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useEffect } from "react";

import type { OpeningRules } from "@/ui/design-system/kit/words";
import { FIRST_BUILD } from "../build/first-build";
import { useDockArmies } from "../hud/dock-armies";
import { useRacesAspects } from "../aspect/races-aspects";
import { useRealmStores } from "../realm-stores";
import { type Opened, type OpeningMoment } from "./opening";
import { type OpeningHeld, accountProgress, nextLine, openedMoments, reachedOnState } from "./opening-state";
import { flush, loadOpening, reachMoments, seeLine, useOpeningStore } from "./opening-store";

/** How often a failed read or send is tried again while the HUD is up. */
const RETRY_MS = 15_000;

/**
 * What the HUD shows and the one line to say now, for the player's own realm in a game that races Aspects (any other
 * game's HUD shows every part): the moments the realm's state reaches, and those the account reached before (kept on its
 * identity account, and on this device meanwhile). Show everything turns every part on. A moment reached is recorded at
 * once, so the part stays when the state that reached it passes; a line waits until the account's progress has been
 * read, so a returning player never meets the first line again.
 */
export function useOpening(
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
): { opened: Opened; line: { moment: OpeningMoment; rules: OpeningRules } | null; gotIt: () => void } {
  const owner = notificationOwnerOf(useIdentitySession().session);
  useEffect(() => {
    void loadOpening(owner);
  }, [owner]);
  useEffect(() => {
    const retry = () => void flush();
    const timer = setInterval(retry, RETRY_MS);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, []);
  const races = useRacesAspects();
  const showEverything = useWorldAppearanceStore((state) => state.showEverything);
  // Only the current account's progress counts: another's, or none yet, is an empty account that is not yet known.
  const progress = accountProgress(
    owner,
    useOpeningStore((state) => state),
  );
  const onState = reachedOnState(useOpeningHeld(rules, realm));
  const key = onState.join();
  useEffect(() => {
    if (realm && races) void reachMoments(key.split(","));
  }, [realm, races, key]);
  const opened = openedMoments(progress.reached, onState);
  const moment = realm && progress.known ? nextLine(opened, progress.seen) : null;
  const lineRules = useOpeningRules(rules, realm);
  return {
    opened: showEverything || !realm || races !== true ? "all" : opened,
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
  useNativeRevision(RACE_MODELS);
  const armies = useDockArmies(realm);
  const essence = useRealmStores(realm, rules)?.essence.amount;
  if (!realm) return {};
  const home = safeInteger(realm.entity_id);
  const { spacing } = setup.store.require("SettlementRules", { game_id: realm.game_id });
  const deep = armies.some((army) => {
    const tile = setup.store.entityOccupancy(realm.game_id, army.explorerId);
    return tile !== undefined && isDeepTile(spacing, tile);
  });
  const bane = readDailyQuest(setup.store, realm.game_id, home, now)?.reading.known?.bane !== undefined;
  // The Aspect's page opens with the first of the Deep, a bane on the Aspect and the first stage its hyperstructure builds.
  const race = readRaceBoard(setup.store, realm.game_id, BigInt(home), now).known?.race;
  const stageBuilt = (race?.standings.find((row) => row.aspect === race.own?.aspect)?.stage ?? 1) > 1;
  return {
    barracks: getBuildingQuantity(home, FIRST_BUILD, setup.store) > 0,
    fight: armies.some((army) => (army.xp ?? 0) > 0),
    essence: (essence ?? 0) > 0,
    deep,
    bane,
    aspects: deep || bane || stageBuilt,
  };
}
