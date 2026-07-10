import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  env: {
    VITE_PUBLIC_CARTRIDGE_API_BASE: "https://api.cartridge.gg",
    VITE_FACTORY_RUNTIME_PROVIDER: "",
    VITE_AWS_RUNTIME_DOMAIN: "",
    VITE_PUBLIC_RUNTIME_REGISTRY_JSON: "",
  },
}));

vi.mock("../../../env", () => envMock);

const { getFactorySqlBaseUrl } = await import("./factory-endpoints");

describe("getFactorySqlBaseUrl", () => {
  beforeEach(() => {
    envMock.env.VITE_PUBLIC_CARTRIDGE_API_BASE = "https://api.cartridge.gg";
    envMock.env.VITE_FACTORY_RUNTIME_PROVIDER = "";
    envMock.env.VITE_AWS_RUNTIME_DOMAIN = "";
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_JSON = "";
  });

  it("keeps Cartridge as the default factory endpoint", () => {
    expect(getFactorySqlBaseUrl("slot")).toBe("https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql");
  });

  it("uses Vite factory runtime config for AWS factory endpoints", () => {
    envMock.env.VITE_FACTORY_RUNTIME_PROVIDER = "aws";
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_JSON = JSON.stringify({
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
          runtimeName: "eternum-factory-slot-d",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            slot: "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
            aws: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/eternum-factory-slot-d/torii/sql",
          },
        },
      },
    });

    expect(getFactorySqlBaseUrl("slot")).toBe(
      "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/eternum-factory-slot-d/torii/sql",
    );
  });
});
