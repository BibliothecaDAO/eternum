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

it("keeps an undeclared join's fixed fallback across both Effect boundaries", async () => {
  const failure = await Effect.runPromise(
    relayOperation("advance official shard", () =>
      Effect.runPromise(
        relayOperation("relay_account_join_failed", async () => {
          throw new TypeError("Invalid redirect");
        }),
      ),
    ).pipe(Effect.flip),
  );
  expect(failure.operation).toBe("relay_account_join_failed");
});

it.each([
  "frontier_funding_missing",
  "frontier_funding_differs_from_game",
  "invalid_frontier_deposit",
  "frontier_snapshot_behind_directory",
  "frontier_pool_confirmation_pending",
  "frontier_pool_differs_from_ledger",
])("exposes the fixed pool failure %s in the health observation", async (code) => {
  const failure = await Effect.runPromise(
    relayOperation("publish Frontier pools", async () => {
      throw new Error(code);
    }).pipe(Effect.flip),
  );
  expect(failure.operation).toBe(code);
});
