import { expect, it } from "vitest";
import { Effect } from "effect";
import { serviceError, ServiceResponseFailure } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";

it("preserves a declared relay failure through the signing boundary", async () => {
  const error = await Effect.runPromise(
    relayOperation("join relay shard account", async () => {
      throw new Error("unlisted_shard");
    }).pipe(Effect.mapError((error) => new Error(error.operation))),
  ).catch((error) => error);
  expect(serviceError(error, ["unlisted_shard"], "unavailable")).toBe("unlisted_shard");
});

it.each(["relay_device_approval_refused: HTTP 401; code unauthorized", "account_join_read_failed"])(
  "keeps join failure %s through Effect",
  async (message) => {
    const failure = await Effect.runPromise(
      relayOperation("relay_account_join_failed", async () => {
        throw message.includes(":")
          ? new ServiceResponseFailure({
              stage: "relay_device_approval_refused",
              status: 401,
              code: "unauthorized",
              message,
            })
          : new Error(message);
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
  "shard_abi_unavailable",
  "frontier_funding_missing",
  "frontier_funding_differs_from_game",
  "frontier_pool_differs_from_ledger",
])("keeps the declared failure %s as the operation", async (code) => {
  const failure = await Effect.runPromise(
    relayOperation("read ledger payment", async () => {
      throw new Error(code);
    }).pipe(Effect.flip),
  );
  expect(failure.operation).toBe(code);
});
