import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearInstalledRuntimeRegistry,
  getEmbeddedReadOnlyRuntimeRegistry,
} from "../../../../../common/factory/runtime-registry";
import { registerReadyGameStack } from "../../../../../common/factory/runtime-registry-artifact";

const envMock = vi.hoisted(() => ({
  env: {
    VITE_PUBLIC_CHAIN: "slot",
    VITE_PUBLIC_GAME_TYPE: "blitz",
    VITE_PUBLIC_RUNTIME_REGISTRY_JSON: "",
    VITE_PUBLIC_RUNTIME_REGISTRY_URL: "",
  },
}));

vi.mock("../../env", () => envMock);

const {
  loadConfiguredRuntimeRegistry,
  resolveChainRpcEndpoint,
  resolveGameRuntimeEndpoint,
  resolveGlobalToriiEndpoint,
} = await import("./runtime-endpoints");

describe("runtime endpoint registry loading", () => {
  beforeEach(() => {
    clearInstalledRuntimeRegistry();
    envMock.env.VITE_PUBLIC_CHAIN = "slot";
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_JSON = "";
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_URL = "";
  });

  it("fails closed when mainnet has no configured registry", async () => {
    envMock.env.VITE_PUBLIC_CHAIN = "mainnet";

    await expect(loadConfiguredRuntimeRegistry()).rejects.toThrow("Required runtime registry URL is missing");
  });

  it("fails closed when the mainnet registry cannot be loaded", async () => {
    envMock.env.VITE_PUBLIC_CHAIN = "mainnet";
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_URL = "https://registry.realms.world/runtime.json";

    await expect(
      loadConfiguredRuntimeRegistry((async () => {
        throw new Error("connection refused");
      }) as typeof fetch),
    ).rejects.toThrow("Required runtime registry is unavailable: connection refused");
  });

  it("loads the public registry before resolving endpoints", async () => {
    const alias = "game.sepolia.blitz.game-42.torii.base";
    const registry = {
      ...getEmbeddedReadOnlyRuntimeRegistry(),
      revision: 2,
      aliases: {
        ...getEmbeddedReadOnlyRuntimeRegistry().aliases,
        [alias]: {
          scope: "game" as const,
          environmentId: "sepolia.blitz",
          runtimeKind: "torii" as const,
          endpointKind: "base" as const,
          activeProvider: "aws" as const,
          runtimeName: "game-42",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            aws: "https://s0.sepolia-blitz.runtime.realms.world/x/game-42/torii",
          },
        },
      },
    };
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_URL = "https://registry.realms.world/runtime.json";
    const fetchImpl = (async () => Response.json(registry)) as typeof fetch;

    const result = await loadConfiguredRuntimeRegistry(fetchImpl);

    expect(result.source).toBe("remote");
    expect(resolveGameRuntimeEndpoint("game-42", "base", { chain: "sepolia" })).toContain(
      "s0.sepolia-blitz.runtime.realms.world",
    );
  });

  it("resolves mainnet Blitz only when both AWS runtimes are complete and unexpired", async () => {
    envMock.env.VITE_PUBLIC_CHAIN = "mainnet";
    envMock.env.VITE_PUBLIC_RUNTIME_REGISTRY_URL = "https://registry.realms.world/runtime.json";
    const registry = registerReadyGameStack(
      getEmbeddedReadOnlyRuntimeRegistry(),
      {
        environmentId: "mainnet.blitz",
        gameStackId: "blitz-season-42",
        activeUntil: "2099-07-18T14:30:00.000Z",
        attestationMeasurement: `sha384:${"c".repeat(96)}`,
        verification: {
          identitySealedAt: "2025-07-18T12:20:00.000Z",
          attestationVerifiedAt: "2025-07-18T12:25:00.000Z",
          worldReadyAt: "2025-07-18T12:30:00.000Z",
          indexerReadyAt: "2025-07-18T12:35:00.000Z",
          registryVerifiedAt: "2025-07-18T12:40:00.000Z",
        },
        katana: {
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          endpoints: {
            base: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/katana",
            health: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/katana/health",
            rpc: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/katana/rpc/v0_9",
          },
        },
        torii: {
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
          imageDigest: `sha256:${"b".repeat(64)}`,
          routingShard: 0,
          endpoints: {
            base: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii",
            health: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii/health",
            sql: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii/sql",
          },
        },
      },
      new Date("2025-07-18T12:41:00.000Z"),
    );

    await loadConfiguredRuntimeRegistry((async () => Response.json(registry)) as typeof fetch);

    expect(resolveGameRuntimeEndpoint("blitz-season-42", "sql")).toContain("blitz-season-42/torii/sql");
    expect(resolveGlobalToriiEndpoint("mainnet")).toContain("blitz-season-42/torii");
    expect(() => resolveGameRuntimeEndpoint("s0-game-1", "sql")).toThrow("is not the registry's active stack");
  });
});
