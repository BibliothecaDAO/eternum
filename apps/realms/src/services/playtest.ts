import { Context, Effect, Layer, Schema } from "effect";
import { env } from "@/env";
import { decodeBoundary } from "./platform/decode";
import { LaunchUnavailable } from "./platform/errors";
import { requestJson } from "./platform/http";

const PlaytestSlot = Schema.Struct({
  name: Schema.String,
  closesAt: Schema.String,
  frozenAt: Schema.NullOr(Schema.String),
  closed: Schema.Boolean,
  registrations: Schema.Array(
    Schema.Struct({
      owner: Schema.String,
      position: Schema.Number,
      gameNumber: Schema.NullOr(Schema.Number),
    }),
  ),
});
export type PlaytestSlot = typeof PlaytestSlot.Type;

const makePlaytestClient = () => {
  const request = <A>(path: string, schema: Schema.ConstraintDecoder<A, never>, post = false) =>
    requestJson(`${env.VITE_PUBLIC_LAUNCH_SERVICE_URL.replace(/\/$/, "")}${path}`, {
      credentials: "include",
      ...(post ? { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } : {}),
    }).pipe(
      Effect.mapError((cause) => new LaunchUnavailable({ path, cause })),
      Effect.filterOrFail(
        (response) => response.status >= 200 && response.status < 300,
        (response) => new LaunchUnavailable({ path, cause: response.body }),
      ),
      Effect.flatMap((response) => decodeBoundary(`playtest:${path}`, schema)(response.body)),
    );
  return {
    slots: request("/api/slots", Schema.Struct({ slots: Schema.Array(PlaytestSlot) })).pipe(
      Effect.map((body) => body.slots),
    ),
    register: (name: string) => request(`/api/slots/${encodeURIComponent(name)}/register`, PlaytestSlot, true),
  };
};

export class PlaytestClient extends Context.Service<PlaytestClient, ReturnType<typeof makePlaytestClient>>()(
  "PlaytestClient",
) {
  static readonly layer = Layer.succeed(PlaytestClient, makePlaytestClient());
}
