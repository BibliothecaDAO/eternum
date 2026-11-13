import { configManager, getHyperstructureProgress, readAspectRace } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HyperstructureConstruction } from "./hyperstructure-design";

/**
 * How much of its tower a Season 1 hyperstructure stands, out of 100, at each stage built: a fifth more at each stage
 * (the owner's pick eternum/s1-hs-stages, 13 November 2026). The finished one is complete and wakes.
 */
const STAGE_TOWER = { 0: 0, 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 } as const satisfies Record<
  0 | 1 | 2 | 3 | 4 | 5,
  number
>;

/**
 * A hyperstructure's construction as its tower draws it: an Aspect's in a race game by the stages its height has built
 * (AspectHyperstructure), any other by the resources contributed to it.
 */
export function readHyperstructureConstruction(store: NativeFactStore, entityId: number): HyperstructureConstruction {
  const standing = aspectStanding(store, entityId);
  if (standing)
    return {
      entityId,
      progress: STAGE_TOWER[standing.stage as keyof typeof STAGE_TOWER],
      completed: standing.finished,
    };
  const { percentage, completed } = getHyperstructureProgress(entityId, store);
  return { entityId, progress: percentage, completed };
}

/** The race standing of the Aspect whose hyperstructure this is; none for a hyperstructure no Aspect builds. */
const aspectStanding = (store: NativeFactStore, entityId: number) => {
  const gameId = configManager.getActiveGameId();
  const row = [...store.inGame("AspectHyperstructure", gameId)].find((each) => Number(each.entity_id) === entityId);
  if (!row) return undefined;
  return readAspectRace(store, gameId)?.standings.find((standing) => standing.aspect === row.aspect);
};
