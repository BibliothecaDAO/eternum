export * from "./game-scope";
export * from "./herald-http";
export * from "./herald-session";
export * from "./native-fact-store";
export { nativeModelDefinition } from "./native-models";
export * from "./submit";
export * from "./shard";
export * from "./story-participants";

export type { NativeRows, NativeKeys, NativeModelName } from "../../../../contracts/l3/world-native/schema/client.gen";
export {
  nativeResearchConstants,
  nativeRuleConstants,
  nativeQuestConstants,
  nativeBaneConstants,
  nativeRaceConstants,
} from "../../../../contracts/l3/world-native/schema/client.gen";

export type { GameClientSetup } from "./game-client";

export { hasSingleTilePosition } from "./native-occupancy";

export { entityMapPosition } from "../utils/tile";
export { safeInteger } from "../utils/safe-integer";

export { armyCombatRefusal } from "../utils/army-opponents";
export { readDeepSites, type DeepSiteView } from "./views/deep-sites";
export { readRaceBoard, readRaceMonument, RACE_MODELS, type RaceBoard } from "./views/race";
export { currentArmy } from "../utils/deep";
export { deepCenter, isDeepTile } from "../utils/deep-geometry";
