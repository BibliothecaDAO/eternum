/**
 * The operator API as its callers see it: what each route returns and accepts. The admin page and the test Blitz
 * script read these types; the routes in app.ts, slot-routes.ts and calendar-routes.ts are their one source.
 */
import type { GameEnvironmentId } from "../../../config/shared/game-environments";
import type { SeasonPhase, SeasonPhaseName } from "./calendar";
import type { toFactoryRunRecord } from "./model";
import type { PlaytestSlot } from "./slots";
import type { TestBlitz } from "./test-blitz";

/** Every game environment the launch service runs. */
export const GAME_ENVIRONMENTS = [
  "madara.blitz",
  "madara.frontier",
  "madara.eternum",
] as const satisfies readonly GameEnvironmentId[];

/** One run as `GET /api/factory/runs` and `GET /api/factory/runs/:environment/:name` return it. */
export type FactoryRunRecord = ReturnType<typeof toFactoryRunRecord>;

export type { GameEnvironmentId, PlaytestSlot, SeasonPhase, SeasonPhaseName, TestBlitz };
/** `POST /api/factory/release` and its answer. */
export type { ApplyReleaseRequest, ReleaseReport } from "./release";

/** `POST /api/slots`. */
export interface OpenSlotRequest {
  name: string;
  closesAt: string;
}

/** `PUT /api/factory/calendar/:phase`. */
export interface SetPhaseRequest {
  startsAt: string;
  endsAt: string;
}
