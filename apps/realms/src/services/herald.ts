import { Context, Effect, Layer, Schema } from "effect";

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

const GameStatus = Schema.Literals(["Created", "Registration", "Live", "Ended", "Settled"]);
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
  mode: Schema.NullOr(Schema.Literals(["blitz", "eternum"])),
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
type Directory = typeof Directory.Type;

const Health = Schema.Struct({
  confirmed_block: Schema.Number,
  success: Schema.Boolean,
});
type HeraldHealth = typeof Health.Type;

const makeHeraldClient = () => {
  const heraldGet = <A>(path: string, schema: Schema.ConstraintDecoder<A, never>) =>
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
};

type HeraldClientShape = ReturnType<typeof makeHeraldClient>;

export class HeraldClient extends Context.Service<HeraldClient, HeraldClientShape>()("HeraldClient") {
  static readonly layer = Layer.succeed(HeraldClient, makeHeraldClient());
}
