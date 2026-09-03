import { describe, expect, test } from "bun:test";
import type { RegistrarManifest } from "../registrar/calls";

const {
  assertRegistrarAvailable,
  resolveRegistrarExecutionDetails,
  resolveRegistrarContractAddress,
  resolveRegistrarWorldAddress,
  resolveCreatedGameId,
} = await import("../registrar/calls");

const manifest: RegistrarManifest = {
  events: [{ tag: "s2-GameCreated", selector: "0xabc" }],
};

describe("registrar receipt parsing", () => {
  test("uses fixed zero-price bounds on the fee-free lab chain", () => {
    expect(resolveRegistrarExecutionDetails("madara.blitz")).toEqual({
      version: 3,
      tip: 0,
      resourceBounds: {
        l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l2_gas: { max_amount: 1_200_000_000n, max_price_per_unit: 0n },
      },
    });
  });

  test("reads a directly emitted GameCreated key", () => {
    const receipt = {
      events: [{ keys: ["0xabc", "0x7"], data: [] }],
    };

    expect(resolveCreatedGameId(receipt, manifest)).toBe(7);
  });

  test("reads GameCreated from the Dojo EventEmitted envelope", () => {
    const receipt = {
      events: [
        {
          keys: ["0x111", "0xabc", "0x222"],
          data: ["0x2", "0x7", "0x1", "0x4", "0x0", "0x123", "0x456", "0x789"],
        },
      ],
    };

    expect(resolveCreatedGameId(receipt, manifest)).toBe(7);
  });

  test("ignores unrelated events", () => {
    const receipt = {
      events: [{ keys: ["0xdef", "0x7"], data: [] }],
    };

    expect(resolveCreatedGameId(receipt, manifest)).toBeUndefined();
  });

  test("rejects a stale pre-A2 appchain manifest", () => {
    const staleManifest: RegistrarManifest = {
      world: { address: "0xstaleworld" },
      contracts: [
        {
          tag: "s1_eternum-registrar_systems",
          address: "0xstaleregistrar",
          systems: ["create_game"],
        },
        { tag: "s1_eternum-blitz_realm_systems", address: "0xstaleblitz" },
      ],
    };

    expect(() => resolveRegistrarWorldAddress(staleManifest)).toThrow("s2-registrar_systems is missing");
    expect(() => resolveRegistrarContractAddress("blitz_realm_systems", staleManifest)).toThrow(
      "blitz_realm_systems is missing",
    );
  });

  test("resolves the Madara registrar from the deployed manifest", () => {
    expect(resolveRegistrarContractAddress("registrar_systems", "madara.blitz")).toBe(
      "0x765e9ea6caf96b51e28c22337869615e101db8f61665750830c2bf51eb6a553",
    );
  });
});
