import { Effect, Schema } from "effect";

import { env } from "@/env";
import { decodeBoundary } from "./platform/decode";
import type { BoundaryDecodeError } from "./platform/errors";
import { HeraldUnreachable } from "./platform/errors";
import { requestJson } from "./platform/http";

/**
 * Herald is the only source for live game facts (directory, history, review).
 * Payload shapes mirror apps/herald/src/http.ts and game-directory.ts; the
 * schemas decode exactly the fields this app renders.
 */

const GameStatus = Schema.Literal("Created", "Registration", "Live", "Ended", "Settled");
type GameStatus = typeof GameStatus.Type;

const GameClock = Schema.Struct({
  end_at: Schema.Number,
  start_main_at: Schema.Number,
  start_settling_at: Schema.Number,
});

const GameRegistration = Schema.Struct({
  count: Schema.Number,
  max: Schema.Number,
  start_at: Schema.Number,
});

export const DirectoryGame = Schema.Struct({
  clock: GameClock,
  dev_mode_on: Schema.Boolean,
  game_id: Schema.Number,
  mode: Schema.NullOr(Schema.Literal("blitz", "eternum")),
  name: Schema.String,
  player_count: Schema.Number,
  preset_id: Schema.Number,
  registration: Schema.NullOr(GameRegistration),
  status: GameStatus,
});
export type DirectoryGame = typeof DirectoryGame.Type;

const Directory = Schema.Struct({
  chain: Schema.String,
  confirmed_block: Schema.Number,
  games: Schema.Array(DirectoryGame),
});
export type Directory = typeof Directory.Type;

const Health = Schema.Struct({
  confirmed_block: Schema.Number,
  success: Schema.Boolean,
});
export type HeraldHealth = typeof Health.Type;

export class HeraldClient extends Effect.Service<HeraldClient>()("HeraldClient", {
  sync: () => {
    const heraldGet = <A, I>(path: string, schema: Schema.Schema<A, I>) =>
      requestJson(`${env.VITE_PUBLIC_HERALD_URL}${path}`).pipe(
        Effect.mapError((cause) => new HeraldUnreachable({ path, cause })),
        Effect.filterOrFail(
          (response) => response.status === 200,
          (response) => new HeraldUnreachable({ path, cause: `status ${response.status}` }),
        ),
        Effect.flatMap((response) => decodeBoundary(`herald:${path}`, schema)(response.body)),
      );

    const directory: Effect.Effect<Directory, HeraldUnreachable | BoundaryDecodeError> = heraldGet(
      `/${env.VITE_PUBLIC_HERALD_CHAIN}/games`,
      Directory,
    );

    const health: Effect.Effect<HeraldHealth, HeraldUnreachable | BoundaryDecodeError> = heraldGet("/health", Health);

    return { directory, health };
  },
}) {}
