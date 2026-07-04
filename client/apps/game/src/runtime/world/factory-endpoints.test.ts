import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  env: {
    VITE_PUBLIC_CARTRIDGE_API_BASE: "https://api.cartridge.gg",
    VITE_FACTORY_RUNTIME_PROVIDER: "",
    VITE_AWS_RUNTIME_DOMAIN: "",
  },
}));

vi.mock("../../../env", () => envMock);

const { getFactorySqlBaseUrl } = await import("./factory-endpoints");

describe("getFactorySqlBaseUrl", () => {
  beforeEach(() => {
    envMock.env.VITE_PUBLIC_CARTRIDGE_API_BASE = "https://api.cartridge.gg";
    envMock.env.VITE_FACTORY_RUNTIME_PROVIDER = "";
    envMock.env.VITE_AWS_RUNTIME_DOMAIN = "";
  });

  it("keeps Cartridge as the default factory endpoint", () => {
    expect(getFactorySqlBaseUrl("slot")).toBe("https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql");
  });

  it("uses Vite factory runtime config for AWS factory endpoints", () => {
    envMock.env.VITE_FACTORY_RUNTIME_PROVIDER = "aws";
    envMock.env.VITE_AWS_RUNTIME_DOMAIN = "runtime.realms.world";

    expect(getFactorySqlBaseUrl("slot")).toBe(
      "https://runtime.realms.world/x/slot-blitz/eternum-factory-slot-d/torii/sql",
    );
  });
});
