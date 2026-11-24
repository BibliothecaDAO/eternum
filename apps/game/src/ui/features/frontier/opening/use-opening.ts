import { useGame } from "@/hooks/context/game-context";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { isSeasonZeroPlayer } from "@/shell/season-tab/archive/archive";
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
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { catalogAspectId, getNeighborHexes, RealmLevels } from "@bibliothecadao/types";
import { useEffect } from "react";

import type { OpeningRules } from "@/ui/design-system/kit/words";
import { FIRST_BUILD } from "../build/first-build";
import { useDockArmies } from "../hud/dock-armies";
import { useRacesAspects } from "../aspect/races-aspects";
import { readPickEffectBase } from "../pick-effect-text";
import { useRealmStores } from "../realm-stores";
import { type Opened, type OpeningContext, type OpeningMoment } from "./opening";
import {
  accountProgress,
  activeOpeningMoment,
  openedMoments,
  reachedOnContext,
  siteAlertOfferDue,
} from "./opening-state";
import { SITE_ALERT_OFFER } from "./use-site-alert-offer";
import { flush, loadOpening, reachMoments, seeLine, skipTutorial, useOpeningStore } from "./opening-store";

const CONTEXT_MODELS = ["RealmKnowledge", "ArmyRelics", "ArmyProgress", "HomeAspect", "TileOpt"] as const;
const RETRY_MS = 15_000;

export function useOpening(
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
): {
  opened: Opened;
  line: { moment: OpeningMoment; rules: OpeningRules } | null;
  dismiss: () => void;
  skipAll: () => void;
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
  const progress = accountProgress(
    owner,
    useOpeningStore((state) => state),
  );
  const ctx = useOpeningContext(rules, realm, progress.reached);
  const onState = reachedOnContext(ctx);
  const key = onState.join();
  useEffect(() => {
    if (realm && races && key.length > 0) void reachMoments(key.split(","));
  }, [realm, races, key]);

  const opened = openedMoments(progress.reached, onState);
  const lineRules = useOpeningRules(rules, realm);
  const moment = realm && progress.known ? activeOpeningMoment(ctx, lineRules, progress.seen) : null;

  return {
    opened: showEverything || !realm || races !== true || !progress.ownsParts ? "all" : opened,
    line: showEverything || !moment || !lineRules ? null : { moment, rules: lineRules },
    dismiss: () => {
      if (moment) void seeLine(moment);
    },
    skipAll: () => void skipTutorial(),
    offerDue:
      Boolean(realm) && races === true && siteAlertOfferDue(opened, progress.seen, progress.known, SITE_ALERT_OFFER),
  };
}

function useOpeningRules(rules: ExpeditionRules, realm: NativeRows["Structure"] | null): OpeningRules | null {
  const { setup } = useGame();
  useNativeRevision(["HomeAspect"]);
  const stores = useRealmStores(realm, rules);
  const troopsPerHour = stores?.troops.perHour;
  if (!realm || troopsPerHour === undefined) return null;
  const barracks = getBuildingQuantity(safeInteger(realm.entity_id), FIRST_BUILD, setup.store);
  const slice = setup.store.get("SliceRules", { game_id: realm.game_id });
  const pickBase = readPickEffectBase(setup.store, realm.game_id);
  if (!slice || pickBase.staminaPerSecond === undefined || pickBase.revealStamina === undefined) return null;
  const tickSeconds = Number(slice.tick_config.armies_tick_in_seconds);
  const rawAspect = setup.store.get("HomeAspect", { game_id: realm.game_id, home: realm.entity_id })?.aspect;
  const ownAspect = rawAspect !== undefined ? catalogAspectId(rawAspect) : undefined;
  return {
    ownAspect,
    knightsPerSecond: troopsPerHour / Math.max(1, barracks) / 3_600,
    troopsAtHome: stores?.troops.amount ?? 0,
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

function useOpeningContext(
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  reached: ReadonlySet<string>,
): OpeningContext | null {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  useNativeRevision(RACE_MODELS);
  useNativeRevision(CONTEXT_MODELS);
  const armies = useDockArmies(realm);
  const stores = useRealmStores(realm, rules);
  const playerAddress = useAccountStore((state) => state.account?.address ?? null);

  if (!realm) return null;

  const home = safeInteger(realm.entity_id);
  const learned = setup.store.get("RealmKnowledge", { game_id: realm.game_id, structure_id: home })?.learned ?? 0n;
  const { spacing } = setup.store.require("SettlementRules", { game_id: realm.game_id });
  const travelCost = setup.store.require("SliceRules", { game_id: realm.game_id }).troop_stamina_config
    .stamina_travel_stamina_cost;
  const outOfStamina = armies.some((army) => army.stamina !== undefined && army.stamina.current < travelCost);
  const hasOpenOathPick = armies.some((army) => {
    const progress = setup.store.get("ArmyProgress", { game_id: realm.game_id, explorer_id: army.explorerId });
    return progress !== undefined && progress.oath_pick !== 0;
  });
  const hasSwornOath = armies.some((army) => {
    const progress = setup.store.get("ArmyProgress", { game_id: realm.game_id, explorer_id: army.explorerId });
    return progress !== undefined && progress.oaths !== 0;
  });
  const hasRelic = armies.some((army) =>
    carriesRelic(setup.store.get("ArmyRelics", { game_id: realm.game_id, explorer_id: army.explorerId })),
  );
  const inEthereal = armies.some((army) => army.ethereal !== undefined);
  const inDeep = armies.some((army) => {
    const tile = setup.store.entityOccupancy(realm.game_id, army.explorerId);
    return tile !== undefined && isDeepTile(spacing, tile);
  });
  const questReading = readDailyQuest(setup.store, realm.game_id, home, now)?.reading.known;
  const hasActiveBane = questReading?.bane !== undefined && questReading?.bane !== null;
  const dailyQuestClaimable = questReading?.state === "done" || questReading?.state === "again";
  const race = readRaceBoard(setup.store, realm.game_id, BigInt(home), now).known?.race;
  const hyperstructureAdvanced = (race?.standings.find((row) => row.aspect === race.own?.aspect)?.stage ?? 1) > 1;
  const hasEssence = (stores?.essence.amount ?? 0) > 0;
  const hasExplored = reached.has("explore") || hasExploredBeyondHomeRing(setup.store, realm, spacing);

  return {
    hasRealm: true,
    hasBarracks: getBuildingQuantity(home, FIRST_BUILD, setup.store) > 0,
    troopsAtHome: stores?.troops.amount ?? 0,
    deployedArmies: armies.length,
    hasExplored,
    hasOpenOathPick,
    hasSwornOath,
    hasEssence,
    hasResearched: learned > 0n,
    dailyQuestClaimable,
    hasWellLore: researchTier(learned, research.ROW_LORE) >= research.LORE_WELLS,
    hasShrineLore: researchTier(learned, research.ROW_LORE) >= research.LORE_SHRINES,
    isCity: realm.base.level >= RealmLevels.City,
    inEthereal,
    inDeep,
    hasActiveBane,
    hyperstructureAdvanced,
    fragmentsSold: fragmentsSold(setup.store, realm.game_id),
    outOfStamina,
    hasRelic,
    isSeasonZeroVeteran: isSeasonZeroPlayer(playerAddress),
  };
}

function hasExploredBeyondHomeRing(store: NativeFactStore, realm: NativeRows["Structure"], spacing: number): boolean {
  const homeTile = store.entityOccupancy(realm.game_id, realm.entity_id);
  if (!homeTile) return false;
  const ring = new Set<string>([
    `${homeTile.col},${homeTile.row}`,
    ...getNeighborHexes(homeTile.col, homeTile.row).map((hex) => `${hex.col},${hex.row}`),
  ]);
  const halfSlice = spacing / 2;
  for (const tile of store.inGame("TileOpt", realm.game_id)) {
    if (tile.alt || isDeepTile(spacing, tile)) continue;
    if (Math.abs(tile.col - homeTile.col) >= halfSlice || Math.abs(tile.row - homeTile.row) >= halfSlice) continue;
    if (!ring.has(`${tile.col},${tile.row}`)) return true;
  }
  return false;
}

const carriesRelic = (relics: Pick<NativeRows["ArmyRelics"], "first" | "second" | "third"> | undefined): boolean =>
  relics !== undefined && [relics.first, relics.second, relics.third].some((slot) => slot !== null);
