import { describe, expect, mock, test } from "bun:test";
import type { RegistrarManifest } from "../registrar/calls";

mock.module("../../../../contracts/game/manifest_appchain.json", () => ({
  default: {
    world: { address: "0xsharedworld" },
    contracts: [
      {
        tag: "s2_blitz-registrar_systems",
        address: "0xregistrar",
        systems: ["bootstrap_chain_config", "register_preset", "register_series", "create_game"],
      },
    ],
    events: [{ tag: "s2_blitz-GameCreated", selector: "0xabc" }],
  },
}));

const { resolveCreatedGameId } = await import("../registrar/calls");

const manifest: RegistrarManifest = {
  events: [{ tag: "s2_blitz-GameCreated", selector: "0xabc" }],
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
});
