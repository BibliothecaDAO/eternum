import { aspects, type AspectId } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";

/** The stages a hyperstructure is built in: the last finishes it (race.cairo: finished at `stage_height` × 5). */
export const HYPERSTRUCTURE_STAGES = 5;

/** One Aspect's hyperstructure in the race: its place, its height, the stages built of it, and whether it finished. */
export type AspectStanding = { aspect: AspectId; rank: number; height: number; stage: number; finished: boolean };

/** The race between the four Aspects' hyperstructures, as the game's facts hold it. */
export type AspectRace = {
  stageHeight: number;
  /** The height that finishes a hyperstructure and ends the age. */
  finishHeight: number;
  /** The Aspect whose hyperstructure finished; null while the race runs or once the mist won. */
  winner: AspectId | null;
  /** The four Aspects, the finished one first, then by height, a tie to the lower Aspect (race.cairo `aspect_order`). */
  standings: AspectStanding[];
};

/**
 * The race of a game's four hyperstructures (C17): each Aspect's AspectHyperstructure height, its stage and its place.
 * Null in a game that races none (no RaceRules once the snapshot's scope is known); undefined while that, or any
 * Aspect's hyperstructure, is still on its way.
 */
export function readAspectRace(
  store: Pick<NativeFactStore, "get" | "subscriptionScope">,
  gameId: number,
): AspectRace | null | undefined {
  const rules = store.get("RaceRules", { game_id: gameId });
  if (!rules) return store.subscriptionScope().known ? null : undefined;
  const heights = aspects.map(({ id }) => ({
    aspect: id,
    row: store.get("AspectHyperstructure", { game_id: gameId, aspect: id }),
  }));
  if (heights.some(({ row }) => !row)) {
    if (store.subscriptionScope().known) throw new Error("A race game holds every Aspect's hyperstructure");
    return undefined;
  }
  const winner = store.get("RaceResult", { game_id: gameId })?.winner ?? null;
  const finishHeight = rules.stage_height * HYPERSTRUCTURE_STAGES;
  const standings = heights
    .map(({ aspect, row }) => ({ aspect, height: row!.height }))
    .sort(
      (a, b) => Number(b.aspect === winner) - Number(a.aspect === winner) || b.height - a.height || a.aspect - b.aspect,
    )
    .map(({ aspect, height }, index) => ({
      aspect,
      rank: index + 1,
      height,
      stage: Math.min(HYPERSTRUCTURE_STAGES, Math.floor(height / rules.stage_height)),
      finished: height >= finishHeight,
    }));
  return { stageHeight: rules.stage_height, finishHeight, winner: winner as AspectId | null, standings };
}
