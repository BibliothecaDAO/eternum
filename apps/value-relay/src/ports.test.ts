import { expect, it } from "vitest";
import { Effect } from "effect";
import { serviceError } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";

it("preserves a declared relay failure through the effect and HTTP boundaries", async () => {
  const error = await Effect.runPromise(
    relayOperation("enrol relay shard account", async () => {
      throw new Error("relay_target_differs");
    }).pipe(Effect.mapError((error) => new Error(error.operation))),
  ).catch((error) => error);
  expect(serviceError(error, ["relay_target_differs"], "unavailable")).toBe("relay_target_differs");
});
