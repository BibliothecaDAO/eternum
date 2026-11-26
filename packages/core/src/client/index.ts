export * from "./game-scope";
export * from "./herald-http";
export * from "./herald-session";
export * from "./native-fact-store";
export { nativeModelDefinition } from "./native-models";
export * from "./submit";
export * from "./shard";
export * from "./story-participants";
export { waitForConfirmedActionReceipt } from "./transaction-outcome";
export { TransactionNoAnswerError } from "./transaction-answer";

export type { NativeRows, NativeKeys, NativeModelName } from "../../../../contracts/l3/world-native/schema/client.gen";
export {
  nativeResearchConstants,
  nativeOathConstants,
  nativeRuleConstants,
  nativeQuestConstants,
  nativeBaneConstants,
  nativeRaceConstants,
  nativeFragmentConstants,
  nativeStructureConstants,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
export { previewRuinGuardBounds } from "../../../../contracts/l3/world-native/schema/site-previews.gen";

export type { GameClientSetup } from "./game-client";
export { assertReleaseReadable } from "./game-release";

export { hasSingleTilePosition } from "./native-occupancy";

export { entityMapPosition } from "../utils/tile";
export { safeInteger } from "../utils/safe-integer";

export { armyCombatRefusal, isAspectAlly, viewerAspects } from "../utils/army-opponents";
export { spendsFragments } from "../utils/mode-rules";
export { armyDrain, deepArmyLife, deepTroopsLife, type DeepArmyLife } from "../utils/deep-army-life";
export {
  IncompleteDeepSyncError,
  homeAspect,
  isBesideDeepSite,
  isDeepSiteRival,
  readDeepSite,
  readDeepBeastTroops,
  readDeepRingOpening,
  readDeepSiteDefender,
  readDeepSites,
  type DeepGarrison,
  type DeepSiteView,
} from "./views/deep-sites";
export {
  compareAspectMembers,
  gloryAmount,
  raceFinishHeight,
  raceStage,
  raceStageHeight,
  rankRaceStandings,
  readRaceBoard,
  RACE_MODELS,
  type RaceBoard,
  type RaceMemberRow,
} from "./views/race";
export { questBonusPercent, sellsFragments } from "./views/quests";
export { currentArmy, currentResourceWeight } from "../utils/deep";
export {
  deepCenter,
  deepGateTiles,
  deepViewFor,
  deepZoneAt,
  deepZoneBounds,
  isDeepTile,
  type DeepZone,
} from "../utils/deep-geometry";
export { questWeek } from "../utils/daily-quest";
export { TRIUMPH_MODELS, triumphPercentsOf, type TriumphStage } from "./views/triumphs";

export { SITE_EFFECT_MODELS, readSiteEffects, readSiteReward } from "./views/site-effects";
export { GUARD_MODELS } from "../utils/army";
