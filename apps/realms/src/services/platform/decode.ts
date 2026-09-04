import { Effect, Schema } from "effect";

import { BoundaryDecodeError } from "./errors";

/**
 * Every payload that enters the app crosses through a schema; an undecodable
 * payload fails loudly with the boundary's name instead of leaking a partial
 * value into rendering.
 */
export const decodeBoundary =
  <A>(boundary: string, schema: Schema.ConstraintDecoder<A, never>) =>
  (value: unknown): Effect.Effect<A, BoundaryDecodeError> =>
    Schema.decodeUnknownEffect(schema, { onExcessProperty: "ignore" })(value).pipe(
      Effect.mapError((cause) => new BoundaryDecodeError({ boundary, cause })),
    );
