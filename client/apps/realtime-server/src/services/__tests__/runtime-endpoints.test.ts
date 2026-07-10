import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearInstalledRuntimeRegistry,
  getDefaultRuntimeRegistry,
} from "../../../../../../common/factory/runtime-registry";
import { loadConfiguredRuntimeRegistry, resolveFactoryToriiSqlEndpoint } from "../runtime-endpoints";

describe("realtime runtime endpoint registry", () => {
  afterEach(() => {
    clearInstalledRuntimeRegistry();
    delete process.env.RUNTIME_REGISTRY_JSON;
    delete process.env.RUNTIME_REGISTRY_URL;
  });

  it("uses a remotely activated provider after startup loading", async () => {
    const alias = "factory.slot.eternum.torii.sql";
    const registry = {
      ...getDefaultRuntimeRegistry(),
      revision: 2,
      aliases: {
        ...getDefaultRuntimeRegistry().aliases,
        [alias]: {
          ...getDefaultRuntimeRegistry().aliases[alias],
          activeProvider: "aws" as const,
          runtimeName: "factory",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            slot: "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
            aws: "https://s0.slot-eternum.runtime.realms.world/x/slot-eternum/factory/torii/sql",
          },
        },
      },
    };
    process.env.RUNTIME_REGISTRY_URL = "https://registry.realms.world/runtime.json";
    const fetchImpl = vi.fn(async () => Response.json(registry)) as unknown as typeof fetch;

    const result = await loadConfiguredRuntimeRegistry(fetchImpl);

    expect(result.source).toBe("remote");
    expect(resolveFactoryToriiSqlEndpoint("slot")).toContain("s0.slot-eternum.runtime.realms.world");
  });

  it("keeps the embedded Slot registry when the remote document fails", async () => {
    process.env.RUNTIME_REGISTRY_JSON = JSON.stringify(getDefaultRuntimeRegistry());
    process.env.RUNTIME_REGISTRY_URL = "https://registry.realms.world/runtime.json";
    const fetchImpl = vi.fn(async () => {
      throw new Error("network unavailable");
    }) as unknown as typeof fetch;

    const result = await loadConfiguredRuntimeRegistry(fetchImpl);

    expect(result.source).toBe("embedded");
    expect(result.remoteError).toBe("network unavailable");
    expect(resolveFactoryToriiSqlEndpoint("slot")).toContain("api.cartridge.gg");
  });
});
