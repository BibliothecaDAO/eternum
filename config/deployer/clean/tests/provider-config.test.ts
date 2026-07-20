import { afterEach, describe, expect, test } from "bun:test";
import { resolveDeploymentEnvironment } from "../environment";
import { resolveRuntimeProvider } from "../runtime/provider-config";

const PROVIDER_ENV_KEYS = ["RUNTIME_PROVIDER", "RUNTIME_PROVIDER_OVERRIDE"] as const;
const originalEnv = new Map<string, string | undefined>(PROVIDER_ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of PROVIDER_ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("resolveRuntimeProvider", () => {
  test("defaults mainnet environments to AWS", () => {
    delete process.env.RUNTIME_PROVIDER;
    delete process.env.RUNTIME_PROVIDER_OVERRIDE;

    expect(resolveRuntimeProvider(resolveDeploymentEnvironment("mainnet.blitz"))).toBe("aws");
    expect(resolveRuntimeProvider(resolveDeploymentEnvironment("mainnet.eternum"))).toBe("aws");
  });

  test("resolves first-class slottest deployment environments", () => {
    expect(resolveDeploymentEnvironment("slottest.blitz")).toMatchObject({
      chain: "slottest",
      rpcUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-test/katana/rpc/v0_9",
      runtimeProvider: "slot",
    });
    expect(resolveDeploymentEnvironment("slottest.eternum").configPath).toBe("config/generated/eternum.slottest.json");
  });

  test("rejects historical Slot environments and provider overrides for new runtime resolution", () => {
    const environment = resolveDeploymentEnvironment("slot.blitz");

    delete process.env.RUNTIME_PROVIDER;
    delete process.env.RUNTIME_PROVIDER_OVERRIDE;
    expect(() => resolveRuntimeProvider(environment)).toThrow("historical Slot runtime state");

    process.env.RUNTIME_PROVIDER = "aws";
    expect(resolveRuntimeProvider(environment)).toBe("aws");

    process.env.RUNTIME_PROVIDER_OVERRIDE = "slot";
    expect(() => resolveRuntimeProvider(environment)).toThrow("historical read-only provider");
  });

  test("rejects invalid provider values", () => {
    process.env.RUNTIME_PROVIDER_OVERRIDE = "cartridge";

    expect(() => resolveRuntimeProvider(resolveDeploymentEnvironment("slot.blitz"))).toThrow(
      'Unsupported runtime provider "cartridge"',
    );
  });
});
