import { afterEach, describe, expect, mock, test } from "bun:test";
import type { GameManifestLike } from "../shared/manifest-types";

mock.module("starknet", () => ({
  shortString: {
    decodeShortString: () => "",
  },
}));

const { getFactorySqlBaseUrl } = await import("../../../../common/factory/endpoints");
const { resolveVillageSystemsAddress } = await import("../factory/discovery.ts");

const FACTORY_ENDPOINT_ENV_KEYS = ["RUNTIME_PROVIDER", "RUNTIME_REGISTRY_JSON"] as const;

const originalEnv = new Map<string, string | undefined>(
  FACTORY_ENDPOINT_ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of FACTORY_ENDPOINT_ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("resolveVillageSystemsAddress", () => {
  test("prefers the exact eternum village_systems tag", () => {
    const manifest: GameManifestLike = {
      contracts: [
        { tag: "world-village_systems", address: "0x2" },
        { tag: "s1_eternum-village_systems", address: "0x1" },
      ],
    };

    expect(resolveVillageSystemsAddress(manifest)).toBe("0x1");
  });

  test("falls back to the village_systems suffix when the exact tag is absent", () => {
    const manifest: GameManifestLike = {
      contracts: [{ tag: "custom-village_systems", address: "0xabc" }],
    };

    expect(resolveVillageSystemsAddress(manifest)).toBe("0xabc");
  });
});

describe("getFactorySqlBaseUrl", () => {
  test("keeps Cartridge factory Torii as the default lookup path", () => {
    delete process.env.RUNTIME_PROVIDER;

    expect(getFactorySqlBaseUrl("slot")).toBe("https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql");
  });

  test("resolves factory Torii through the AWS registry target when selected", () => {
    process.env.RUNTIME_PROVIDER = "aws";
    process.env.RUNTIME_REGISTRY_JSON = JSON.stringify({
      schemaVersion: "realms-runtime-registry/v1",
      revision: 2,
      generatedAt: "2026-07-10T00:00:00.000Z",
      aliases: {
        "factory.slot.blitz.torii.sql": {
          scope: "factory",
          environmentId: "slot.blitz",
          runtimeKind: "torii",
          endpointKind: "sql",
          activeProvider: "aws",
          runtimeName: "eternum-factory-slot",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            slot: "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
            aws: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/eternum-factory-slot/torii/sql",
          },
        },
      },
    });

    expect(getFactorySqlBaseUrl("slot")).toBe(
      "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/eternum-factory-slot/torii/sql",
    );
  });
});
