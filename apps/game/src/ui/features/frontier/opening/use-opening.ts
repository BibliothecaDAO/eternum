import { useGame } from "@/hooks/context/game-context";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import {
  type ExpeditionRules,
  DAILY_QUEST_MODELS,
  fragmentsSold,
  getBuildingQuantity,
  readDailyQuest,
  researchTier,
} from "@bibliothecadao/eternum";
import {
  isDeepTile,
  nativeFragmentConstants,
  nativeOathConstants,
  nativeResearchConstants as research,
  nativeRuleConstants,
  previewRuinGuardBounds,
  RACE_MODELS,
  readRaceBoard,
  safeInteger,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { RealmLevels } from "@bibliothecadao/types";
import { useEffect } from "react";

import type { OpeningRules } from "@/ui/design-system/kit/words";
import { FIRST_BUILD } from "../build/first-build";
import { useDockArmies } from "../hud/dock-armies";
import { useRacesAspects } from "../aspect/races-aspects";
import { readPickEffectBase } from "../pick-effect-text";
import { useRealmStores } from "../realm-stores";
import { type Opened, type OpeningMoment } from "./opening";
import {
  type OpeningHeld,
  accountProgress,
  nextLine,
  siteAlertOfferDue,
  openedMoments,
  reachedOnState,
} from "./opening-state";
import { SITE_ALERT_OFFER } from "./use-site-alert-offer";
import { flush, loadOpening, reachMoments, seeLine, useOpeningStore } from "./opening-store";

const KNOWLEDGE_MODELS = ["RealmKnowledge"] as const;
const RELIC_MODELS = ["ArmyRelics"] as const;
const PROGRESS_MODELS = ["ArmyProgress"] as const;

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
): {
  opened: Opened;
  line: { moment: OpeningMoment; rules: OpeningRules } | null;
  gotIt: () => void;
  /** The site alert's first-entry offer is due: the Deep entered, and the offer not yet answered. */
  offerDue: boolean;
} {
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
  const missingDeepRule = moment === "deep" && lineRules?.deepLossPerTick === undefined;
  return {
    opened: showEverything || !realm || races !== true || !progress.ownsParts ? "all" : opened,
    line: showEverything || !moment || !lineRules || missingDeepRule ? null : { moment, rules: lineRules },
    gotIt: () => moment && void seeLine(moment),
    offerDue:
      Boolean(realm) && races === true && siteAlertOfferDue(opened, progress.seen, progress.known, SITE_ALERT_OFFER),
  };
}

/** The rules a line names, read from the game's own rows; none while a row is not read, so no line says a made-up figure. */
function useOpeningRules(rules: ExpeditionRules, realm: NativeRows["Structure"] | null): OpeningRules | null {
  const { setup } = useGame();
  const troops = useRealmStores(realm, rules)?.troops.perHour;
  if (!realm || troops === undefined) return null;
  const barracks = getBuildingQuantity(safeInteger(realm.entity_id), FIRST_BUILD, setup.store);
  const slice = setup.store.get("SliceRules", { game_id: realm.game_id });
  const pickBase = readPickEffectBase(setup.store, realm.game_id);
  if (!slice || pickBase.staminaPerSecond === undefined || pickBase.revealStamina === undefined) return null;
  const tickSeconds = Number(slice.tick_config.armies_tick_in_seconds);
  return {
    knightsAnHour: troops / Math.max(1, barracks),
    deepTickSeconds: tickSeconds,
    deepLossPerTick: pickBase.deepLossPerTick,
    oathPassStamina: nativeOathConstants.PASS_STAMINA,
    spireDepthFactor: previewRuinGuardBounds(2, 1)[0] / previewRuinGuardBounds(1, 0)[0],
    staminaPerSecond: pickBase.staminaPerSecond,
    staminaPerFragment: nativeFragmentConstants.STAMINA_PER_FRAGMENT,
    relicMinutesPerTier: slice.relic_seconds_per_rank / 60,
    scoutExploreStamina: nativeRuleConstants.SCOUT_EXPLORE_STAMINA,
    exploreStamina: pickBase.revealStamina,
  };
}

/** What the realm holds or has done now, from the game's facts, for each moment its state can reach. */
function useOpeningHeld(rules: ExpeditionRules, realm: NativeRows["Structure"] | null): OpeningHeld | null {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  useNativeRevision(RACE_MODELS);
  useNativeRevision(KNOWLEDGE_MODELS);
  useNativeRevision(RELIC_MODELS);
  useNativeRevision(PROGRESS_MODELS);
  const armies = useDockArmies(realm);
  const essence = useRealmStores(realm, rules)?.essence.amount;
  if (!realm) return null;
  const home = safeInteger(realm.entity_id);
  const learned = setup.store.get("RealmKnowledge", { game_id: realm.game_id, structure_id: home })?.learned ?? 0n;
  const { spacing } = setup.store.require("SettlementRules", { game_id: realm.game_id });
  const travelCost = setup.store.require("SliceRules", { game_id: realm.game_id }).troop_stamina_config
    .stamina_travel_stamina_cost;
  const outOfStamina = armies.some((army) => army.stamina !== undefined && army.stamina.current < travelCost);
  const oath = armies.some((army) => {
    const progress = setup.store.get("ArmyProgress", { game_id: realm.game_id, explorer_id: army.explorerId });
    return progress !== undefined && (progress.oath_pick !== 0 || progress.oaths !== 0);
  });
  const relic = armies.some((army) =>
    carriesRelic(setup.store.get("ArmyRelics", { game_id: realm.game_id, explorer_id: army.explorerId })),
  );
  const spire = armies.some((army) => army.ethereal !== undefined);
  const deep = armies.some((army) => {
    const tile = setup.store.entityOccupancy(realm.game_id, army.explorerId);
    return tile !== undefined && isDeepTile(spacing, tile);
  });
  const bane = readDailyQuest(setup.store, realm.game_id, home, now)?.reading.known?.bane !== undefined;
  // The Aspect's page opens with the first of the Deep, a bane on the Aspect and the first stage its hyperstructure builds.
  const race = readRaceBoard(setup.store, realm.game_id, BigInt(home), now).known?.race;
  const stageBuilt = (race?.standings.find((row) => row.aspect === race.own?.aspect)?.stage ?? 0) >= 1;
  return {
    barracks: getBuildingQuantity(home, FIRST_BUILD, setup.store) > 0,
    oath,
    shop: fragmentsSold(setup.store, realm.game_id) && outOfStamina,
    relic,
    city: realm.base.level >= RealmLevels.City,
    essence: (essence ?? 0) > 0,
    "well-lore": researchTier(learned, research.ROW_LORE) >= research.LORE_WELLS,
    "shrine-lore": researchTier(learned, research.ROW_LORE) >= research.LORE_SHRINES,
    spire,
    deep,
    bane,
    aspects: deep || bane || stageBuilt,
  };
}

const carriesRelic = (relics: Pick<NativeRows["ArmyRelics"], "first" | "second" | "third"> | undefined): boolean =>
  relics !== undefined && [relics.first, relics.second, relics.third].some((slot) => slot !== null);
