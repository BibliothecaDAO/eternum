import type { FoldRow } from "../types";
import { gameRows } from "./values";

/** Season 1 races Aspects by height: a game with race rules ranks no player by the sites it cleared. */
export function isSeasonOneGame(modelRows: (model: string) => FoldRow[], gameId: unknown): boolean {
  return gameRows(modelRows("RaceRules"), gameId).length > 0;
}
