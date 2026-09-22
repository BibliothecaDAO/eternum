import { frontierSeasonRequest } from "./schemas";
import type { LaunchServiceStore } from "./store";

/** Scheduling is a no-op once the season's run exists, whatever its status, so restarts never create a second game. */
export const scheduleFrontierSeason = (store: LaunchServiceStore, seasonStart: string) =>
  store.enqueue("game", frontierSeasonRequest(seasonStart));
