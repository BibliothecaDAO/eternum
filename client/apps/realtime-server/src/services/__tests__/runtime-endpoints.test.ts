import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearInstalledRuntimeRegistry,
  getEmbeddedReadOnlyRuntimeRegistry,
} from "../../../../../../common/factory/runtime-registry";
import { loadConfiguredRuntimeRegistry, resolveFactoryToriiSqlEndpoint } from "../runtime-endpoints";

describe("realtime runtime endpoint registry", () => {
  afterEach(() => {
    clearInstalledRuntimeRegistry();
    delete process.env.RUNTIME_REGISTRY_JSON;
    delete process.env.RUNTIME_REGISTRY_URL;
  });

  it("uses a remotely published AWS provider after startup loading", async () => {
    const alias = "factory.sepolia.blitz.torii.sql";
    const registry = {
      ...getEmbeddedReadOnlyRuntimeRegistry(),
      revision: 2,
      aliases: {
        ...getEmbeddedReadOnlyRuntimeRegistry().aliases,
        [alias]: {
          scope: "factory" as const,
          environmentId: "sepolia.blitz",
          runtimeKind: "torii" as const,
          endpointKind: "sql" as const,
          activeProvider: "aws" as const,
          runtimeName: "factory",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            aws: "https://s0.sepolia-blitz.runtime.realms.world/x/sepolia-blitz/factory/torii/sql",
          },
        },
      },
    };
    process.env.RUNTIME_REGISTRY_URL = "https://registry.realms.world/runtime.json";
    const fetchImpl = vi.fn(async () => Response.json(registry)) as unknown as typeof fetch;

    const result = await loadConfiguredRuntimeRegistry(fetchImpl);

    expect(result.source).toBe("remote");
    expect(resolveFactoryToriiSqlEndpoint("sepolia")).toContain("s0.sepolia-blitz.runtime.realms.world");
  });

  it("keeps the embedded Slot registry when the remote document fails", async () => {
    process.env.RUNTIME_REGISTRY_JSON = JSON.stringify(getEmbeddedReadOnlyRuntimeRegistry());
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
