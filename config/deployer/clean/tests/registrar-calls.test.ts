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
  world: { address: "0x123", abi: [...Object.values(schema.types), ...schema.domains.season.entrypoints] },
  native: {
    activeSchema: schema.identity,
    schemas: { [schema.identity]: schema },
    version: 2,
  },
} as unknown as RegistrarManifest;

describe("native registrar", () => {
  test("uses fixed zero-price bounds on the lab chain", () => {
    expect(resolveRegistrarExecutionDetails().resourceBounds?.l2_gas).toEqual({
      max_amount: 1_200_000_000n,
      max_price_per_unit: 0n,
    });
  });
  test("rejects a non-native manifest before any transaction", () => {
    expect(() => assertRegistrarAvailable({ world: { address: "0x123" } } as RegistrarManifest)).toThrow(
      "no active native schema",
    );
    const legacy = structuredClone(manifest);
    legacy.native.schemas[schema.identity].domains.season.contract = "SeasonDomain";
    expect(() => assertRegistrarAvailable(legacy)).toThrow("Games ABI");
  });
  test("resolves the world from the validated native deployment", () => {
    assertRegistrarAvailable(manifest);
    expect(resolveRegistrarWorldAddress(manifest)).toBe("0x123");
  });
  test("accepts each declared game row prefix only from Games", () => {
    const model = schema.models.find((model) => model.name === "GameRegistry")!;
    for (const layout of schema.domains.registry.events.filter((event) => event.name === "RowSet")) {
      const event = {
        from_address: "0x123",
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
  const settlement = await settleBlitzRoster(
    provider as unknown as RpcProvider,
    7,
    { accountAddress: "0x123", privateKey: "0x1234" },
    manifest,
    "http://unused.invalid",
  );
  expect(settlement).toEqual({ finalizeAt: 305, settlementTransactions: 0 });
  expect(provider.callContract).toHaveBeenCalledTimes(1);
  expect(provider.callContract).toHaveBeenCalledWith(
    { contractAddress: "0x123", entrypoint: "game", calldata: [7] },
    "latest",
  );
});
