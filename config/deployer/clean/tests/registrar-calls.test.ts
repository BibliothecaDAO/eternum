import { describe, expect, mock, test } from "bun:test";
import type { RegistrarManifest } from "../registrar/calls";

mock.module("../../../../contracts/game/manifest_appchain_blitz.json", () => ({
  default: {
    world: { address: "0xsharedworld" },
    contracts: [
      {
        tag: "s2-registrar_systems",
        address: "0xregistrar",
        systems: ["bootstrap_chain_config", "register_preset", "register_series", "create_game"],
      },
    ],
    events: [{ tag: "s2-GameCreated", selector: "0xabc" }],
  },
}));

const {
  assertRegistrarAvailable,
  resolveRegistrarContractAddress,
  resolveRegistrarWorldAddress,
  resolveCreatedGameId,
} = await import("../registrar/calls");

const manifest: RegistrarManifest = {
  events: [{ tag: "s2-GameCreated", selector: "0xabc" }],
};

describe("registrar receipt parsing", () => {
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

  test("resolves the eternum world registrar now that both s2 worlds are deployed", () => {
    expect(() => assertRegistrarAvailable("appchain.eternum")).not.toThrow();
  });
});
