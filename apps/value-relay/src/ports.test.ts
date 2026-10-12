import { expect, it } from "vitest";
import { Effect } from "effect";
import { serviceError } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";

it("preserves a declared relay failure through the signing boundary", async () => {
  const error = await Effect.runPromise(
    relayOperation("join relay shard account", async () => {
      throw new Error("relay_shard_inactive");
    }).pipe(Effect.mapError((error) => new Error(error.operation))),
  ).catch((error) => error);
  expect(serviceError(error, ["relay_shard_inactive"], "unavailable")).toBe("relay_shard_inactive");
});
