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

it.each(["relay_device_approval_refused: HTTP 401; code unauthorized", "account_join_read_failed"])(
  "keeps join failure %s through Effect",
  async (message) => {
    const failure = await Effect.runPromise(
      relayOperation("relay_account_join_failed", async () => {
        throw new Error(message);
      }).pipe(Effect.flip),
    );
    expect(failure.operation).toBe(message.split(":")[0]);
  },
);
