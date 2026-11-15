import { configManager, getHyperstructureProgress } from "@bibliothecadao/eternum";
import { nativeRaceConstants, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HyperstructureConstruction } from "./hyperstructure-design";

/**
 * A hyperstructure's construction as its tower draws it: an Aspect's in a race game by the stages its height has built
 * (the owner's pick eternum/s1-hs-stages: a fifth of the tower for each stage of the race, the finished one complete),
 * any other by the resources contributed to it.
 */
export function readHyperstructureConstruction(store: NativeFactStore, entityId: number): HyperstructureConstruction {
  const race = aspectRaceHeight(store, entityId);
  if (race) {
    const built = Math.min(nativeRaceConstants.STAGE_COUNT, Math.floor(race.height / race.stageHeight));
    return {
      entityId,
      progress: (100 * built) / nativeRaceConstants.STAGE_COUNT,
      completed: built === nativeRaceConstants.STAGE_COUNT,
    };
  }
  const { percentage, completed } = getHyperstructureProgress(entityId, store);
  return { entityId, progress: percentage, completed };
}

/** The height of the Aspect whose hyperstructure this is, and a stage's height; none for one no Aspect builds. */
const aspectRaceHeight = (store: NativeFactStore, entityId: number) => {
  const gameId = configManager.getActiveGameId();
  const row = [...store.inGame("AspectHyperstructure", gameId)].find((each) => Number(each.entity_id) === entityId);
  const rules = store.get("RaceRules", { game_id: gameId });
  return row && rules ? { height: row.height, stageHeight: rules.stage_height } : undefined;
};
