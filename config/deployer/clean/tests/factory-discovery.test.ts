import { afterEach, describe, expect, mock, test } from "bun:test";
import type { GameManifestLike } from "../shared/manifest-types";

mock.module("starknet", () => ({
  shortString: {
    decodeShortString: () => "",
  },
}));

const { getFactorySqlBaseUrl } = await import("../../../../common/factory/endpoints");
const { resolveVillageSystemsAddress } = await import("../factory/discovery.ts");

const FACTORY_ENDPOINT_ENV_KEYS = [
  "FACTORY_RUNTIME_PROVIDER",
  "AWS_RUNTIME_DOMAIN",
  "AWS_FACTORY_TORII_SLOT_RUNTIME_NAME",
  "AWS_FACTORY_TORII_MAINNET_RUNTIME_NAME",
] as const;

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
    delete process.env.FACTORY_RUNTIME_PROVIDER;

    expect(getFactorySqlBaseUrl("slot")).toBe("https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql");
  });

  test("resolves factory Torii through the AWS runtime domain when selected", () => {
    process.env.FACTORY_RUNTIME_PROVIDER = "aws";
    process.env.AWS_RUNTIME_DOMAIN = "runtime.realms.world";
    process.env.AWS_FACTORY_TORII_SLOT_RUNTIME_NAME = "eternum-factory-slot";

    expect(getFactorySqlBaseUrl("slot")).toBe("https://runtime.realms.world/x/eternum-factory-slot/torii/sql");
  });
});
