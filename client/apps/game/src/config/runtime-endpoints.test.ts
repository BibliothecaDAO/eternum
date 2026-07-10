import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearInstalledRuntimeRegistry,
  getDefaultRuntimeRegistry,
} from "../../../../../common/factory/runtime-registry";

const envMock = vi.hoisted(() => ({
  env: {
    VITE_PUBLIC_CHAIN: "slot",
    VITE_PUBLIC_GAME_TYPE: "blitz",
    VITE_PUBLIC_RUNTIME_REGISTRY_JSON: "",
    VITE_PUBLIC_RUNTIME_REGISTRY_URL: "",
  },
}));

vi.mock("../../env", () => envMock);

const { loadConfiguredRuntimeRegistry, resolveChainRpcEndpoint } = await import("./runtime-endpoints");

describe("runtime endpoint registry loading", () => {
  beforeEach(() => {
    clearInstalledRuntimeRegistry();
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_JSON = "";
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_URL = "";
  });

  it("loads the public registry before resolving endpoints", async () => {
    const alias = "shared-chain.slot.katana.rpc";
    const registry = {
      ...getDefaultRuntimeRegistry(),
      revision: 2,
      aliases: {
        ...getDefaultRuntimeRegistry().aliases,
        [alias]: {
          ...getDefaultRuntimeRegistry().aliases[alias],
          activeProvider: "aws" as const,
          runtimeName: "eternum-blitz-slot-4",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            slot: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
            aws: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/katana/rpc/v0_9",
          },
        },
      },
    };
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_URL = "https://registry.realms.world/runtime.json";
    const fetchImpl = (async () => Response.json(registry)) as typeof fetch;

    const result = await loadConfiguredRuntimeRegistry(fetchImpl);

    expect(result.source).toBe("remote");
    expect(resolveChainRpcEndpoint("slot")).toContain("s0.slot-blitz.runtime.realms.world");
  });
});
