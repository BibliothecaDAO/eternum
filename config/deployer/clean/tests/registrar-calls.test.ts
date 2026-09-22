import type { RpcProvider } from "starknet";
import { describe, expect, test, mock } from "bun:test";
import schema from "../../../../contracts/l3/world-native/schema/schema.json";
import {
  assertRegistrarAvailable,
  settleBlitzRoster,
  resolveCreatedGameId,
  resolveRegistrarExecutionDetails,
  resolveRegistrarWorldAddress,
  type RegistrarManifest,
} from "../registrar/calls";

const manifest = {
  world: { address: "0x123" },
  native: {
    activeSchema: schema.identity,
    schemas: { [schema.identity]: schema },
    domains: { registry: { address: "0x456" }, season: { address: "0x123" } },
  },
} as unknown as RegistrarManifest;

describe("native registrar", () => {
  test("uses fixed zero-price bounds on the lab chain", () => {
    expect(resolveRegistrarExecutionDetails("madara.blitz").resourceBounds?.l2_gas).toEqual({
      max_amount: 1_200_000_000n,
      max_price_per_unit: 0n,
    });
  });
  test("rejects a non-native manifest before any transaction", () => {
    expect(() => assertRegistrarAvailable({ world: { address: "0x123" } } as RegistrarManifest)).toThrow(
      "native registry ABI",
    );
  });
  test("resolves the world from the validated native deployment", () => {
    assertRegistrarAvailable(manifest);
    expect(resolveRegistrarWorldAddress(manifest)).toBe("0x123");
  });
  test("accepts each declared game row prefix only from the registry domain", () => {
    const model = schema.models.find((model) => model.name === "GameRegistry")!;
    for (const layout of schema.domains.registry.events.filter((event) => event.name === "RowSet")) {
      const event = {
        from_address: "0x456",
        keys: [...layout.prefix, "1", model.identity],
        data: ["1", "7", "1", "0"],
      };
      expect(resolveCreatedGameId({ events: [event] }, manifest)).toBe(7);
      expect(resolveCreatedGameId({ events: [{ ...event, from_address: "0x999" }] }, manifest)).toBeUndefined();
      expect(resolveCreatedGameId({ events: [{ ...event, data: ["1", "7", "2", "0"] }] }, manifest)).toBeUndefined();
    }
  });
});

test("a ready roster submits no settlement transactions on retry", async () => {
  const provider = {
    callContract: mock(async () => ["1", "2", "291", "0", "1", "0", "100", "200", "300", "5", "1"]),
  };
  const finalizeAt = await settleBlitzRoster(
    provider as unknown as RpcProvider,
    7,
    { accountAddress: "0x123", privateKey: "0x1234" },
    manifest,
    "http://unused.invalid",
  );
  expect(finalizeAt).toBe(305);
  expect(provider.callContract).toHaveBeenCalledTimes(1);
  expect(provider.callContract).toHaveBeenCalledWith(
    { contractAddress: "0x456", entrypoint: "game", calldata: [7] },
    "latest",
  );
});
