import { useGame } from "@/hooks/context/game-context";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { isSeasonZeroPlayer } from "@/shell/season-tab/archive/archive";
import {
  type ExpeditionRules,
  configManager,
  DAILY_QUEST_MODELS,
  entityHomeNamespace,
  expeditionRealmSite,
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
import { catalogAspectId, getNeighborHexes, RealmLevels, ResourcesIds, TroopTier } from "@bibliothecadao/types";
import { useEffect } from "react";

import type { OpeningRules } from "@/ui/design-system/kit/words";
import { buildingOutput } from "@/ui/shared/lib/building-output";
import { FIRST_BUILD } from "../build/first-build";
import { dayClock } from "../hud/day-clock";
import { useDockArmies } from "../hud/dock-armies";
import type { HudSurface } from "../hud/frontier-nav";
import { useRacesAspects } from "../aspect/races-aspects";
import { readPickEffectBase } from "../pick-effect-text";
import { madePicks } from "../production/store-makers";
import { useRealmStores } from "../realm-stores";
import { useResearchTree } from "../research/research-facts";
import { canResearchNow } from "../research/research-tree";
import { type Opened, type OpeningContext } from "./opening";
import {
  accountProgress,
  openedMoments,
  reachedOnContext,
  siteAlertOfferDue,
  stepTutorialMachine,
  type TutorialDisplay,
} from "./opening-state";
import { SITE_ALERT_OFFER } from "./use-site-alert-offer";
import {
  clearConfirmedTutorial,
  commitTutorialStep,
  flush,
  loadOpening,
  reachMoments,
  seeLine,
  skipTutorial,
  useOpeningStore,
} from "./opening-store";

const CONTEXT_MODELS = ["RealmKnowledge", "ArmyRelics", "ArmyProgress", "HomeAspect", "TileOpt"] as const;
const RETRY_MS = 15_000;

export function useOpening(
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  openedSurface: HudSurface | null = null,
): {
  opened: Opened;
  line: TutorialDisplay | null;
  dismiss: () => void;
  skipAll: () => void;
  offerDue: boolean;
} {
  const owner = notificationOwnerOf(useIdentitySession().session) || null;
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
  const storeState = useOpeningStore((state) => state);
  const progress = accountProgress(owner, storeState);
  const ctx = useOpeningContext(rules, realm, progress.reached, openedSurface);
  const onState = reachedOnContext(ctx);
  const key = onState.join();
  useEffect(() => {
    if (realm && races && key.length > 0) void reachMoments(key.split(","));
  }, [realm, races, key]);

  const opened = openedMoments(progress.reached, onState);
  const lineRules = useOpeningRules(rules, realm);
  const canEvaluate = Boolean(realm) && !showEverything && progress.known && storeState.loaded;
  const transition = canEvaluate
    ? stepTutorialMachine({
        showing: storeState.showing,
        confirmed: storeState.confirmed,
        ctx,
        rules: lineRules,
        seen: progress.seen,
      })
    : { nextShowing: null, confirmedMoment: null, newlyCompleted: [] };

  const completedKey = transition.newlyCompleted.join();
  useEffect(() => {
    if (!canEvaluate) {
      if (showEverything) void commitTutorialStep({ completed: [], showing: null, confirmed: null });
      return;
    }
    void commitTutorialStep({
      completed: completedKey.length > 0 ? completedKey.split(",") : [],
      showing: transition.nextShowing,
      confirmed: transition.confirmedMoment,
    });
  }, [canEvaluate, showEverything, completedKey, transition.nextShowing, transition.confirmedMoment]);

  const activeLine: TutorialDisplay | null =
    !canEvaluate || !lineRules
      ? null
      : transition.confirmedMoment !== null
        ? { moment: transition.confirmedMoment, rules: lineRules, status: "completed" }
        : transition.nextShowing !== null
          ? { moment: transition.nextShowing, rules: lineRules, status: "showing" }
          : null;

  return {
    opened: showEverything || !realm || races !== true || !progress.ownsParts ? "all" : opened,
    line: activeLine,
    dismiss: () => {
      if (!activeLine) return;
      if (activeLine.status === "completed") clearConfirmedTutorial();
      else void seeLine(activeLine.moment);
    },
    skipAll: () => void skipTutorial(),
    offerDue:
      Boolean(realm) && races === true && siteAlertOfferDue(opened, progress.seen, progress.known, SITE_ALERT_OFFER),
  };
}

function useOpeningRules(rules: ExpeditionRules, realm: NativeRows["Structure"] | null): OpeningRules | null {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(["HomeAspect", "RealmKnowledge", "BoardRules", "ResourceRule"]);
  const stores = useRealmStores(realm, rules);
  if (!realm) return null;
  const slice = setup.store.get("SliceRules", { game_id: realm.game_id });
  const pickBase = readPickEffectBase(setup.store, realm.game_id);
  const hasOutputRules =
    setup.store.get("BoardRules", { game_id: realm.game_id }) !== undefined &&
    setup.store.get("ResourceRule", { game_id: realm.game_id, resource_type: ResourcesIds.Knight }) !== undefined;
  if (!slice || !hasOutputRules || pickBase.staminaPerSecond === undefined || pickBase.revealStamina === undefined)
    return null;
  const home = safeInteger(realm.entity_id);
  const learned = setup.store.get("RealmKnowledge", { game_id: realm.game_id, structure_id: home })?.learned ?? 0n;
  const knightsPerSecond = buildingOutput(
    setup.store,
    realm,
    FIRST_BUILD,
    madePicks(ResourcesIds.Knight, learned),
  ).total;
  const tickSeconds = Number(slice.tick_config.armies_tick_in_seconds);
  const rawAspect = setup.store.get("HomeAspect", { game_id: realm.game_id, home: realm.entity_id })?.aspect;
  const ownAspect = rawAspect !== undefined ? catalogAspectId(rawAspect) : undefined;
  const clock = dayClock(rules, now);
  return {
    ownAspect,
    knightsPerSecond,
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
    tomorrowSeconds: clock.tomorrowSeconds,
  };
}

function useOpeningContext(
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  reached: ReadonlySet<string>,
  openedSurface: HudSurface | null,
): OpeningContext | null {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  useNativeRevision(RACE_MODELS);
  useNativeRevision(CONTEXT_MODELS);
  const armies = useDockArmies(realm);
  const stores = useRealmStores(realm, rules);
  const researchTree = useResearchTree(realm);
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
  const bane = questReading?.bane;
  const hasBaneQuorum = bane !== undefined && bane !== null && bane.required > 0;
  const hasBrokenBane = hasBaneQuorum && bane.endedAt !== 0 && bane.endedAt <= now;
  const hasActiveBane = hasBaneQuorum && !hasBrokenBane;
  const dailyQuestClaimable = questReading?.state === "done" || questReading?.state === "again";
  const dailyQuestClaimed = questReading?.state === "collected";
  const race = readRaceBoard(setup.store, realm.game_id, BigInt(home), now).known?.race;
  const hyperstructureAdvanced = (race?.standings.find((row) => row.aspect === race.own?.aspect)?.stage ?? 1) > 1;
  const hasEssence = (stores?.essence.amount ?? 0) > 0;
  const canResearch = canResearchNow(researchTree?.nodes);
  const hasExplored = reached.has("explore") || countExploredBeyondHomeRing(setup.store, realm, rules, now) > 0;
  const clock = dayClock(rules, now);
  const dayEndingSoon = clock.tone === "ember" && clock.secondsLeft !== undefined;

  return {
    hasRealm: true,
    hasBarracks: getBuildingQuantity(home, FIRST_BUILD, setup.store) > 0,
    troopsAtHome: stores?.troops.amount ?? 0,
    fullArmy: configManager.getMaxArmySize(realm.base.level, TroopTier.T1),
    deployedArmies: armies.length,
    hasExplored,
    hasOpenOathPick,
    hasSwornOath,
    hasEssence,
    canResearch,
    hasResearched: learned > 0n,
    questRunning: questReading?.state === "running",
    questProgressed: (questReading?.progress ?? 0n) > 0n,
    dailyQuestClaimable,
    dailyQuestClaimed,
    hasWellLore: researchTier(learned, research.ROW_LORE) >= research.LORE_WELLS,
    hasShrineLore: researchTier(learned, research.ROW_LORE) >= research.LORE_SHRINES,
    isCity: realm.base.level >= RealmLevels.City,
    inEthereal,
    inDeep,
    hasActiveBane,
    hasBrokenBane,
    dayEndingSoon,
    hyperstructureAdvanced,
    hasAspectRace: race !== undefined,
    fragmentsSold: fragmentsSold(setup.store, realm.game_id),
    outOfStamina,
    hasRelic,
    openedToday: openedSurface === "today",
    openedResearch: openedSurface === "research",
    openedSeason: openedSurface === "season",
    openedShop: openedSurface === "shop",
    openedArmy: openedSurface === "army",
    isSeasonZeroVeteran: isSeasonZeroPlayer(playerAddress),
  };
}

function countExploredBeyondHomeRing(
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  now: number,
): number {
  const spacing = rules.spacing;
  const dailySite = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), now);
  const homeTile = dailySite ?? store.entityOccupancy(realm.game_id, realm.entity_id);
  if (!homeTile) return 0;
  const homeRegionCol = Math.floor(homeTile.col / spacing);
  const homeRegionRow = Math.floor(homeTile.row / spacing);
  const ring = new Set<string>([
    `${homeTile.col},${homeTile.row}`,
    ...getNeighborHexes(homeTile.col, homeTile.row).map((hex) => `${hex.col},${hex.row}`),
  ]);
  let count = 0;
  for (const tile of store.inGame("TileOpt", realm.game_id)) {
    if (tile.alt || isDeepTile(spacing, tile)) continue;
    if (Math.floor(tile.col / spacing) !== homeRegionCol || Math.floor(tile.row / spacing) !== homeRegionRow) continue;
    if (!ring.has(`${tile.col},${tile.row}`)) count += 1;
  }
  return count;
}

const carriesRelic = (relics: Pick<NativeRows["ArmyRelics"], "first" | "second" | "third"> | undefined): boolean =>
  relics !== undefined && [relics.first, relics.second, relics.third].some((slot) => slot !== null);
